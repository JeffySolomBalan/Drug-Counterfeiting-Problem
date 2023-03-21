"use strict";
const shim = require("fabric-shim");

const { Contract } = require("fabric-contract-api");
class PharmanetContract extends Contract {
  companyCRNKeyMap = new Map();
  drugNameKeyMap = new Map();

  constructor() {
    super("pharmanet");
  }

  async instantiate(ctx) {
    console.log("Pharmanet Chaincode was successfully deployed!!");
  }

  /**
   * Method to register Entities into the ledger
   */
  async registerCompany(
    ctx,
    companyCRN,
    companyName,
    location,
    organisationRole
  ) {
    const companyKey = ctx.stub.createCompositeKey("pharmanet.company", [
      companyCRN,
      companyName,
    ]);
    let hierarchy;
    switch (organisationRole) {
      case "Manufacturer":
        hierarchy = 1;
        break;
      case "Distributor":
        hierarchy = 2;
        break;
      case "Retailer":
        hierarchy = 3;
        break;
      case "Transporter":
        hierarchy = -1;
        break;
      default:
        throw new Error("Invalid Organization Role");
    }
    const companyObj = {
      companyID: companyKey,
      companyCRN: companyCRN,
      companyName: companyName,
      location: location,
      organisationRole: organisationRole,
      hierarchy: hierarchy,
      createdAt: ctx.stub.getTxTimestamp(),
    };
    const companyBuffer = Buffer.from(JSON.stringify(companyObj));
    await ctx.stub.putState(companyKey, companyBuffer);
    this.companyCRNKeyMap.set(companyCRN, companyKey);
    return companyObj;
  }

  /**
   * Method to add Drug to the ledger by a Manufacturer
   */
  async addDrug(ctx, drugName, serialNo, mfgDate, expDate, companyCRN) {
    if (!this.companyCRNKeyMap.has(companyCRN)) {
      throw new Error("Company with CRN " + companyCRN + " is not available");
    } else {
      const mspId = ctx.clientIdentity.getMSPID();
      if(mspId != 'manufacturerMSP')
      {
        throw new Error("Only Manufacturer can add the drug");
      }
    }
    const drugKey = ctx.stub.createCompositeKey("pharmanet.drug", [
      drugName,
      serialNo,
    ]);
    const drugObj = {
      productID: drugKey,
      drugName: drugName,
      serialNo: serialNo,
      mfgDate: mfgDate,
      expDate: expDate,
      companyCRN: companyCRN,
      manufacturer: this.companyCRNKeyMap.get(companyCRN),
      owner: this.companyCRNKeyMap.get(companyCRN),
      createdAt: ctx.stub.getTxTimestamp(),
    };
    const drugBuffer = Buffer.from(JSON.stringify(drugObj));
    this.drugNameKeyMap.set(drugName, drugKey);
    await ctx.stub.putState(drugKey, drugBuffer);

    return drugObj;
  }

  /*
   * Method to create PO by a Distributor or retailer
   */
  async createPO(ctx, buyerCRN, sellerCRN, drugName, quantity) {
    // const buyerBuffer = await ctx.stub.getState(
    //   this.companyCRNKeyMap.get(buyerCRN)
    // );
    // if (buyerBuffer != null && buyerBuffer.length > 0) {
    //   const companyObj = JSON.parse(buyerBuffer.toString());
    //   if (companyObj.hierarchy !== 2 && companyObj.hierarchy !== 3) {
    //     throw new Error(
    //       "Only Distributor or Retailer can create Purchase Order"
    //     );
    //   }
    // }
    const mspId = ctx.clientIdentity.getMSPID();
    if(mspId != 'distributorMSP' && mspId != 'retailerMSP')
    {
      throw new Error(
              "Only Distributor or Retailer can create Purchase Order"
            );
    }
    const sellerBuffer = await ctx.stub.getState(
      this.companyCRNKeyMap.get(sellerCRN)
    );
    const drugBuffer = await ctx.stub.getState(
      this.drugNameKeyMap.get(drugName)
    );

    if (drugBuffer && drugBuffer.length > 0) {
      const drugObj = JSON.parse(drugBuffer.toString());
      if (drugObj.owner !== this.companyCRNKeyMap.get(sellerCRN)) {
        throw new Error("seller CRN " + sellerCRN + " is not the currentOwner");
      }
    }

    let buyerHierarchy;
    let sellerHierarchy;
    if (buyerBuffer && buyerBuffer.length > 0) {
      const buyerObj = JSON.parse(buyerBuffer.toString());
      buyerHierarchy = buyerObj.hierarchy;
    }

    if (sellerBuffer && sellerBuffer.length > 0) {
      const sellerObj = JSON.parse(sellerBuffer.toString());
      sellerHierarchy = sellerObj.hierarchy;
    }

    if (buyerHierarchy === 3) {
      if (sellerHierarchy !== 2) {
        throw new Error("You can buy drugs only from a distributor");
      }
    } else if (buyerHierarchy === 2) {
      if (sellerHierarchy !== 1) {
        throw new Error("You can buy drugs only from a manufacturer");
      }
    } else if (buyerHierarchy >= sellerHierarchy) {
      throw new Error("You cannot buy from this seller");
    }

    const poKey = ctx.stub.createCompositeKey("pharmanet.PO", [
      buyerCRN,
      drugName,
    ]);
    const poObj = {
      poID: poKey,
      drugName: drugName,
      quantity: quantity,
      buyer: this.companyCRNKeyMap.get(buyerCRN),
      seller: this.companyCRNKeyMap.get(sellerCRN),
      createdAt: ctx.stub.getTxTimestamp(),
    };
    const poBuffer = Buffer.from(JSON.stringify(poObj));
    await ctx.stub.putState(poKey, poBuffer);
    return poObj;
  }

  /*
   * Method to create shipment by seller
   */
  async createShipment(ctx, buyerCRN, drugName, transporterCRN, listOfAssets) {
    const listOfAssetsArray = listOfAssets.split(",");

    if (!this.companyCRNKeyMap.has(transporterCRN)) {
      throw new Error(
        "Transport Company with CRN " +
          transporterCRN +
          " is not yet registered"
      );
    }

    const transportBuffer = await ctx.stub.getState(
      this.companyCRNKeyMap.get(transporterCRN)
    );
    if (transportBuffer && transportBuffer.length > 0) {
      const transportObj = JSON.parse(transportBuffer.toString());
      if (transportObj.organisationRole !== "Transporter") {
        throw new Error(
          "Company with CRN " +
            transporterCRN +
            " is not registered as Transporter"
        );
      }
    }

    const poKey = ctx.stub.createCompositeKey("pharmanet.PO", [
      buyerCRN,
      drugName,
    ]);
    const poBuffer = await ctx.stub.getState(poKey);
    if (poBuffer && poBuffer.length > 0) {
      const poObj = JSON.parse(poBuffer.toString());
      if (poObj.quantity != listOfAssetsArray.length) {
        throw new Error(
          "Number of Assets is not matching with the Purchase Order quantity"
        );
      }
    } else {
      throw new Error("Purchase order is not yet created from buyer end");
    }

    const assetKeys = [];
    for (let i = 0; i < listOfAssetsArray.length; i++) {
      const assetKey = this.drugNameKeyMap.get(listOfAssetsArray[i]);
      if (!assetKey) {
        throw new Error(listOfAssetsArray[i] + "Asset is not available");
      }

      const drugBuffer = await ctx.stub.getState(assetKey);
      if (drugBuffer && drugBuffer.length > 0) {
        const drugObj = JSON.parse(drugBuffer.toString());
        drugObj.owner = this.companyCRNKeyMap.get(transporterCRN);
        const updatedDrugBuffer = Buffer.from(JSON.stringify(drugObj));
        await ctx.stub.putState(assetKey, updatedDrugBuffer);
      } else {
        throw new Error(
          "Drug " + listOfAssetsArray[i] + " is not available in the ledger"
        );
      }
      assetKeys[i] = assetKey;
    }
    const shipmentKey = ctx.stub.createCompositeKey("pharmanet.shipment", [
      buyerCRN,
      drugName,
    ]);
    const shipmentObj = {
      shipmentID: shipmentKey,
      creator: ctx.clientIdentity.getID(),
      assets: assetKeys,
      transporter: this.companyCRNKeyMap.get(transporterCRN),
      status: "In-Transit",
    };
    const shipmentBuffer = Buffer.from(JSON.stringify(shipmentObj));
    await ctx.stub.putState(shipmentKey, shipmentBuffer);
    return shipmentObj;
  }

  /*
   * Method to update shipment status by Transporter
   */
  async updateShipment(ctx, buyerCRN, drugName, transporterCRN) {

    const mspId = ctx.clientIdentity.getMSPID();
    if(mspId != 'transporterMSP')
    {
      throw new Error(
              "Only Transporter can update shipment"
            );
    }

    if (!this.companyCRNKeyMap.has(transporterCRN)) {
      throw new Error(
        "Transport Company with CRN " +
          transporterCRN +
          " is not yet registered"
      );
    }

    const transportBuffer = await ctx.stub.getState(
      this.companyCRNKeyMap.get(transporterCRN)
    );
    if (transportBuffer && transportBuffer.length > 0) {
      const transportObj = JSON.parse(transportBuffer.toString());
      if (transportObj.organisationRole !== "Transporter") {
        throw new Error(
          "Company with CRN " +
            transporterCRN +
            " is not registered as Transporter"
        );
      }
    }

    const shipmentKey = ctx.stub.createCompositeKey("pharmanet.shipment", [
      buyerCRN,
      drugName,
    ]);
    const shipmentBuffer = await ctx.stub.getState(shipmentKey);
    if (shipmentBuffer && shipmentBuffer.length > 0) {
      const shipmentObj = JSON.parse(shipmentBuffer.toString());
      if (
        shipmentObj.transporter !== this.companyCRNKeyMap.get(transporterCRN)
      ) {
        throw new Error(
          "Transporter with CRN " +
            transporterCRN +
            " is not the owner of the mentioned shipment"
        );
      }
      shipmentObj.status = "Delievered";
      const updatedShipmentBuffer = Buffer.from(JSON.stringify(shipmentObj));
      await ctx.stub.putState(shipmentKey, updatedShipmentBuffer);
      const assetKeys = shipmentObj.assets;
      for (let i = 0; i < assetKeys.length; i++) {
        const drugBuffer = await ctx.stub.getState(assetKeys[i]);
        if (drugBuffer && drugBuffer.length > 0) {
          const drugObj = JSON.parse(drugBuffer.toString());
          if (drugObj.owner !== this.companyCRNKeyMap.get(transporterCRN)) {
            throw new Error(
              "Mentioned Transporter is not the owner of the drug"
            );
          }
          drugObj.shipment = shipmentKey;
          drugObj.owner = this.companyCRNKeyMap.get(buyerCRN);
          const updatedDrugBuffer = Buffer.from(JSON.stringify(drugObj));
          await ctx.stub.putState(assetKeys[i], updatedDrugBuffer);
        }
      }
      return shipmentObj;
    }
  }

  /*
   * Method to sell drug to customer by a retailer
   */
  async retailDrug(ctx, drugName, serialNo, retailerCRN, customerAadhar) {
    const mspId = ctx.clientIdentity.getMSPID();
    if(mspId != 'retailerMSP')
    {
      throw new Error(
              "Only Retailer can retail out drugs"
            );
    }
    if (!this.companyCRNKeyMap.has(retailerCRN)) {
      throw new Error(
        "Retailer with CRN " + retailerCRN + " is not yet registered"
      );
    }

    const retailerBuffer = await ctx.stub.getState(
      this.companyCRNKeyMap.get(retailerCRN)
    );
    if (retailerBuffer && retailerBuffer.length > 0) {
      const retailerObj = JSON.parse(retailerBuffer.toString());
      if (retailerObj.hierarchy !== 3) {
        throw new Error(
          "mentioned company crn " +
            retailerCRN +
            " is not registered as retailer"
        );
      }
    }

    if (this.drugNameKeyMap.has(drugName)) {
      const drugBuffer = await ctx.stub.getState(
        this.drugNameKeyMap.get(drugName)
      );
      if (drugBuffer && drugBuffer.length > 0) {
        const drugObj = JSON.parse(drugBuffer.toString());
        const retailerKey = this.companyCRNKeyMap.get(retailerCRN);
        if (drugObj.owner != retailerKey) {
          throw new Error("Only owner can retail out drug");
        }
        drugObj.owner = customerAadhar;
        const updatedDrugBuffer = Buffer.from(JSON.stringify(drugObj));
        await ctx.stub.putState(
          this.drugNameKeyMap.get(drugName),
          updatedDrugBuffer
        );
        return drugObj;
      }
    }
  }

  /*
   * Method to track provenance of drug
   */
  async viewHistory(ctx, drugName, serialNo) {
    const drugKey = this.drugNameKeyMap.get(drugName);
    let iterator = await ctx.stub.getHistoryForKey(drugKey);
    let result = [];
    let res = await iterator.next();
    while (!res.done) {
      if (res.value) {
        const obj = JSON.parse(res.value.value.toString("utf8"));
        result.push(obj);
      }
      res = await iterator.next();
    }
    await iterator.close();
    return result;
  }

  /*
   * Method to view current state of drug
   */
  async viewDrugCurrentState(ctx, drugName, serialNo) {
    if (!this.drugNameKeyMap.has(drugName)) {
      throw new Error("Drug with name " + drugName + " is not available");
    }
    const drugBuffer = await ctx.stub.getState(
      this.drugNameKeyMap.get(drugName)
    );
    if (drugBuffer && drugBuffer.length > 0) {
      const drugObj = JSON.parse(drugBuffer.toString());
      return drugObj;
    }
  }

  /*
   * Method to get company details
   */ 
  async getCompanyDetails(ctx, companyCRN, companyName) {
    if (!this.companyCRNKeyMap.has(companyCRN)) {
      throw new Error("Company with name " + companyName + " is not available");
    }
    const companyBuffer = await ctx.stub.getState(
      this.companyCRNKeyMap.get(companyCRN)
    );
    if (companyBuffer && companyBuffer.length > 0) {
      const companyObj = JSON.parse(companyBuffer.toString());
      return companyObj;
    }
  }
}

module.exports = PharmanetContract;
