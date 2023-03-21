# Drug-Counterfeiting-Problem
This project is about tracking the drug from Manufacturer to Consumer, thus by ensuring originality of drugs. 
Network consists of 4 Organizations 
1. Manufacturer
2. Distributor
3. Retailer
4. Transporter

All Organizations are connected one channel.

Getting Started:
Command to check out Hyperledger project 
curl -sSL https://bit.ly/2ysbOFE | bash -s

Command to generate Cryto materials for each organization
export PATH=${PWD}/../bin:$PATH

export FABRIC_CFG_PATH=$PWD/../config/

cryptogen generate --config=./organizations/cryptogen/crypto-config-orderer.yaml --output="organizations"

cryptogen generate --config=./organizations/cryptogen/crypto-config-org1.yaml --output="organizations"

cryptogen generate --config=./organizations/cryptogen/crypto-config-org2.yaml --output="organizations"

cryptogen generate --config=./organizations/cryptogen/crypto-config-government.yaml --output="organizations"

Command to generate genesis block

export FABRIC_CFG_PATH=${PWD}/configtx
configtxgen -profile DrugOrdererGenesis -channelID system-channel -outputBlock ./system-genesis-block/genesis.block

Command to start docker instances

export IMAGE_TAG=latest
docker-compose -f docker/docker-compose-pharmanet.yaml -f docker/docker-compose-ca.yaml up -d


Command to create channel artifacts & create channel

configtxgen -profile DrugChannel -outputCreateChannelTx ./channel-artifacts/pharmanet3.tx -channelID pharmanet3

export FABRIC_CFG_PATH=$PWD/../config/

export ORDERER_CA=${PWD}/organizations/ordererOrganizations/drug.com/orderers/orderer.drug.com/msp/tlscacerts/tlsca.drug.com-cert.pem

export CORE_PEER_LOCALMSPID="manufacturerMSP"

export CORE_PEER_TLS_ROOTCERT_FILE=${PWD}/organizations/peerOrganizations/manufacturer.drug.com/peers/peer0.manufacturer.drug.com/tls/ca.crt

export CORE_PEER_MSPCONFIGPATH=${PWD}/organizations/peerOrganizations/manufacturer.drug.com/users/Admin@manufacturer.drug.com/msp

export CORE_PEER_ADDRESS=localhost:7051

peer channel create -o localhost:7050 -c pharmanet3 --ordererTLSHostnameOverride orderer.drug.com -f ./channel-artifacts/pharmanet3.tx --outputBlock "./channel-artifacts/pharmanet3.block" --tls --cafile $ORDERER_CA

Make Peer0 of manufacturer to join channel:
-------------------------------------------
export BLOCKFILE="./channel-artifacts/pharmanet3.block"

peer channel join -b $BLOCKFILE

Join Channel for Peer1 of manufacturer
------------------------------

export CORE_PEER_ADDRESS=localhost:8051
peer channel join -b $BLOCKFILE

Join Channel for Peer0 of Distributor
------------------------------

export CORE_PEER_TLS_ENABLED=true
export CORE_PEER_LOCALMSPID="distributorMSP"
export CORE_PEER_TLS_ROOTCERT_FILE=${PWD}/organizations/peerOrganizations/distributor.drug.com/peers/peer0.distributor.drug.com/tls/ca.crt
export CORE_PEER_MSPCONFIGPATH=${PWD}/organizations/peerOrganizations/distributor.drug.com/users/Admin@distributor.drug.com/msp
export CORE_PEER_ADDRESS=localhost:9051

peer channel join -b $BLOCKFILE

Join Channel for Peer1 of Distributor
------------------------------

export CORE_PEER_ADDRESS=localhost:10051
peer channel join -b $BLOCKFILE

Join Channel for Peer0 of Retailer
---------------------------------

export CORE_PEER_TLS_ENABLED=true
export CORE_PEER_LOCALMSPID="retailerMSP"
export CORE_PEER_TLS_ROOTCERT_FILE=${PWD}/organizations/peerOrganizations/retailer.drug.com/peers/peer0.retailer.drug.com/tls/ca.crt
export CORE_PEER_MSPCONFIGPATH=${PWD}/organizations/peerOrganizations/retailer.drug.com/users/Admin@retailer.drug.com/msp
export CORE_PEER_ADDRESS=localhost:11051

peer channel join -b $BLOCKFILE

Join Channel for Peer1 of Retailer
---------------------------------
export CORE_PEER_ADDRESS=localhost:12051
peer channel join -b $BLOCKFILE

Join Channel for Peer0 of Transporter
---------------------------------

export CORE_PEER_TLS_ENABLED=true
export CORE_PEER_LOCALMSPID="transporterMSP"
export CORE_PEER_TLS_ROOTCERT_FILE=${PWD}/organizations/peerOrganizations/transporter.drug.com/peers/peer0.transporter.drug.com/tls/ca.crt
export CORE_PEER_MSPCONFIGPATH=${PWD}/organizations/peerOrganizations/transporter.drug.com/users/Admin@transporter.drug.com/msp
export CORE_PEER_ADDRESS=localhost:13051

peer channel join -b $BLOCKFILE

Join Channel for Peer1 of Transporter
---------------------------------

export CORE_PEER_ADDRESS=localhost:14051
peer channel join -b $BLOCKFILE

Setting Anchor Peer:
--------------------

docker exec -it cli /bin/bash

export ORDERER_CA=${PWD}/organizations/ordererOrganizations/drug.com/orderers/orderer.drug.com/msp/tlscacerts/tlsca.drug.com-cert.pem

export CORE_PEER_LOCALMSPID="manufacturerMSP"

configtxlator proto_decode --input pharmanet.tx --type common.Envelope --output pharmanet1.json

export CORE_PEER_TLS_ROOTCERT_FILE=${PWD}/organizations/peerOrganizations/manufacturer.drug.com/peers/peer0.manufacturer.drug.com/tls/ca.crt

export CORE_PEER_MSPCONFIGPATH=${PWD}/organizations/peerOrganizations/manufacturer.drug.com/users/Admin@manufacturer.drug.com/msp

export CORE_PEER_ADDRESS=peer0.manufacturer.drug.com:7051

peer channel fetch config config_block.pb -o orderer.drug.com:7050 --ordererTLSHostnameOverride orderer.drug.com -c pharmanet3 --tls --cafile $ORDERER_CA


configtxlator proto_decode --input config_block.pb --type common.Block | jq .data.data[0].payload.data.config >"${CORE_PEER_LOCALMSPID}config.json"

export HOST="peer0.manufacturer.drug.com"
export PORT=7051
jq '.channel_group.groups.Application.groups.'${CORE_PEER_LOCALMSPID}'.values += {"AnchorPeers":{"mod_policy": "Admins","value":{"anchor_peers": [{"host": "'$HOST'","port": '$PORT'}]},"version": "0"}}' ${CORE_PEER_LOCALMSPID}config.json > ${CORE_PEER_LOCALMSPID}modified_config.json

configtxlator proto_encode --input "${CORE_PEER_LOCALMSPID}config.json" --type common.Config >original_config.pb
configtxlator proto_encode --input "${CORE_PEER_LOCALMSPID}modified_config.json" --type common.Config >modified_config.pb
configtxlator compute_update --channel_id "pharmanet3" --original original_config.pb --updated modified_config.pb >config_update.pb

configtxlator proto_decode --input config_update.pb --type common.ConfigUpdate >config_update.json

echo '{"payload":{"header":{"channel_header":{"channel_id":"pharmanet3", "type":2}},"data":{"config_update":'$(cat config_update.json)'}}}' | jq . >config_update_in_envelope.json

configtxlator proto_encode --input config_update_in_envelope.json --type common.Envelope >"${CORE_PEER_LOCALMSPID}anchors.tx"

peer channel update -o orderer.drug.com:7050 --ordererTLSHostnameOverride orderer.drug.com -c pharmanet3 -f ${CORE_PEER_LOCALMSPID}anchors.tx --tls --cafile $ORDERER_CA


Update channel config to define anchor peer for distributor
----------------------------------------------------------

export CORE_PEER_LOCALMSPID="distributorMSP"

export CORE_PEER_TLS_ROOTCERT_FILE=${PWD}/organizations/peerOrganizations/distributor.drug.com/peers/peer0.distributor.drug.com/tls/ca.crt


export CORE_PEER_MSPCONFIGPATH=${PWD}/organizations/peerOrganizations/distributor.drug.com/users/Admin@distributor.drug.com/msp

export CORE_PEER_ADDRESS=peer0.distributor.drug.com:9051 

peer channel fetch config config_block.pb -o orderer.drug.com:7050 --ordererTLSHostnameOverride orderer.drug.com -c pharmanet3 --tls --cafile $ORDERER_CA

configtxlator proto_decode --input config_block.pb --type common.Block | jq .data.data[0].payload.data.config >"${CORE_PEER_LOCALMSPID}config.json"

export HOST="peer0.distributor.drug.com"

export PORT=9051

jq '.channel_group.groups.Application.groups.'${CORE_PEER_LOCALMSPID}'.values += {"AnchorPeers":{"mod_policy": "Admins","value":{"anchor_peers": [{"host": "'$HOST'","port": '$PORT'}]},"version": "0"}}' ${CORE_PEER_LOCALMSPID}config.json > ${CORE_PEER_LOCALMSPID}modified_config.json


configtxlator proto_encode --input "${CORE_PEER_LOCALMSPID}config.json" --type common.Config >original_config.pb
configtxlator proto_encode --input "${CORE_PEER_LOCALMSPID}modified_config.json" --type common.Config >modified_config.pb
configtxlator compute_update --channel_id "pharmanet3" --original original_config.pb --updated modified_config.pb >config_update.pb

configtxlator proto_decode --input config_update.pb --type common.ConfigUpdate >config_update.json

echo '{"payload":{"header":{"channel_header":{"channel_id":"pharmanet3", "type":2}},"data":{"config_update":'$(cat config_update.json)'}}}' | jq . >config_update_in_envelope.json

configtxlator proto_encode --input config_update_in_envelope.json --type common.Envelope >"${CORE_PEER_LOCALMSPID}anchors.tx"

peer channel update -o orderer.drug.com:7050 --ordererTLSHostnameOverride orderer.drug.com -c pharmanet3 -f ${CORE_PEER_LOCALMSPID}anchors.tx --tls --cafile $ORDERER_CA


Update channel config to define anchor peer for retailer
--------------------------------------------------------
export CORE_PEER_LOCALMSPID="retailerMSP"

export CORE_PEER_TLS_ROOTCERT_FILE=${PWD}/organizations/peerOrganizations/retailer.drug.com/peers/peer0.retailer.drug.com/tls/ca.crt


export CORE_PEER_MSPCONFIGPATH=${PWD}/organizations/peerOrganizations/retailer.drug.com/users/Admin@retailer.drug.com/msp

export CORE_PEER_ADDRESS=peer0.retailer.drug.com:11051

peer channel fetch config config_block.pb -o orderer.drug.com:7050 --ordererTLSHostnameOverride orderer.drug.com -c pharmanet3 --tls --cafile $ORDERER_CA

configtxlator proto_decode --input config_block.pb --type common.Block | jq .data.data[0].payload.data.config >"${CORE_PEER_LOCALMSPID}config.json"

export HOST="peer0.retailer.drug.com"

export PORT=11051

jq '.channel_group.groups.Application.groups.'${CORE_PEER_LOCALMSPID}'.values += {"AnchorPeers":{"mod_policy": "Admins","value":{"anchor_peers": [{"host": "'$HOST'","port": '$PORT'}]},"version": "0"}}' ${CORE_PEER_LOCALMSPID}config.json > ${CORE_PEER_LOCALMSPID}modified_config.json


configtxlator proto_encode --input "${CORE_PEER_LOCALMSPID}config.json" --type common.Config >original_config.pb
configtxlator proto_encode --input "${CORE_PEER_LOCALMSPID}modified_config.json" --type common.Config >modified_config.pb
configtxlator compute_update --channel_id "pharmanet3" --original original_config.pb --updated modified_config.pb >config_update.pb

configtxlator proto_decode --input config_update.pb --type common.ConfigUpdate >config_update.json

echo '{"payload":{"header":{"channel_header":{"channel_id":"pharmanet3", "type":2}},"data":{"config_update":'$(cat config_update.json)'}}}' | jq . >config_update_in_envelope.json

configtxlator proto_encode --input config_update_in_envelope.json --type common.Envelope >"${CORE_PEER_LOCALMSPID}anchors.tx"

peer channel update -o orderer.drug.com:7050 --ordererTLSHostnameOverride orderer.drug.com -c pharmanet3 -f ${CORE_PEER_LOCALMSPID}anchors.tx --tls --cafile $ORDERER_CA



Update channel config to define anchor peer for transporter
--------------------------------------------------------
export CORE_PEER_LOCALMSPID="transporterMSP"

export CORE_PEER_TLS_ROOTCERT_FILE=${PWD}/organizations/peerOrganizations/transporter.drug.com/peers/peer0.transporter.drug.com/tls/ca.crt


export CORE_PEER_MSPCONFIGPATH=${PWD}/organizations/peerOrganizations/transporter.drug.com/users/Admin@transporter.drug.com/msp

export CORE_PEER_ADDRESS=peer0.transporter.drug.com:13051 

peer channel fetch config config_block.pb -o orderer.drug.com:7050 --ordererTLSHostnameOverride orderer.drug.com -c pharmanet3 --tls --cafile $ORDERER_CA

configtxlator proto_decode --input config_block.pb --type common.Block | jq .data.data[0].payload.data.config >"${CORE_PEER_LOCALMSPID}config.json"

export HOST="peer0.transporter.drug.com"

export PORT=13051

jq '.channel_group.groups.Application.groups.'${CORE_PEER_LOCALMSPID}'.values += {"AnchorPeers":{"mod_policy": "Admins","value":{"anchor_peers": [{"host": "'$HOST'","port": '$PORT'}]},"version": "0"}}' ${CORE_PEER_LOCALMSPID}config.json > ${CORE_PEER_LOCALMSPID}modified_config.json


configtxlator proto_encode --input "${CORE_PEER_LOCALMSPID}config.json" --type common.Config >original_config.pb
configtxlator proto_encode --input "${CORE_PEER_LOCALMSPID}modified_config.json" --type common.Config >modified_config.pb
configtxlator compute_update --channel_id "pharmanet3" --original original_config.pb --updated modified_config.pb >config_update.pb

configtxlator proto_decode --input config_update.pb --type common.ConfigUpdate >config_update.json

echo '{"payload":{"header":{"channel_header":{"channel_id":"pharmanet3", "type":2}},"data":{"config_update":'$(cat config_update.json)'}}}' | jq . >config_update_in_envelope.json

configtxlator proto_encode --input config_update_in_envelope.json --type common.Envelope >"${CORE_PEER_LOCALMSPID}anchors.tx"

peer channel update -o orderer.drug.com:7050 --ordererTLSHostnameOverride orderer.drug.com -c pharmanet3 -f ${CORE_PEER_LOCALMSPID}anchors.tx --tls --cafile $ORDERER_CA


Deploy Chaincode 
----------------

export CHANNEL_NAME=pharmanet3
export CC_NAME=pharmanet
export CC_SRC_PATH=../chaincode
export CC_RUNTIME_LANGUAGE=node
export CC_VERSION=1.0
export CC_SEQUENCE=1
export FABRIC_CFG_PATH=$PWD/../config/
peer lifecycle chaincode package ${CC_NAME}.tar.gz --path ${CC_SRC_PATH} --lang ${CC_RUNTIME_LANGUAGE} --label ${CC_NAME}_${CC_VERSION}

Install in Peer0 of Manufacturer:
--------------------------------
export ORDERER_CA=${PWD}/organizations/ordererOrganizations/drug.com/orderers/orderer.drug.com/msp/tlscacerts/tlsca.drug.com-cert.pem

export CORE_PEER_LOCALMSPID="manufacturerMSP"

export CORE_PEER_TLS_ROOTCERT_FILE=${PWD}/organizations/peerOrganizations/manufacturer.drug.com/peers/peer0.manufacturer.drug.com/tls/ca.crt

export CORE_PEER_MSPCONFIGPATH=${PWD}/organizations/peerOrganizations/manufacturer.drug.com/users/Admin@manufacturer.drug.com/msp

export CORE_PEER_ADDRESS=localhost:7051

peer lifecycle chaincode install ${CC_NAME}.tar.gz

Install in Peer1 of Manufacturer:
--------------------------------
export CORE_PEER_ADDRESS=localhost:8051
peer lifecycle chaincode install ${CC_NAME}.tar.gz

Install in Peer0 of Distributor:
--------------------------------
export CORE_PEER_LOCALMSPID="distributorMSP"

export CORE_PEER_TLS_ROOTCERT_FILE=${PWD}/organizations/peerOrganizations/distributor.drug.com/peers/peer0.distributor.drug.com/tls/ca.crt

export CORE_PEER_MSPCONFIGPATH=${PWD}/organizations/peerOrganizations/distributor.drug.com/users/Admin@distributor.drug.com/msp

export CORE_PEER_ADDRESS=localhost:9051

peer lifecycle chaincode install ${CC_NAME}.tar.gz


export CORE_PEER_ADDRESS=localhost:10051
peer lifecycle chaincode install ${CC_NAME}.tar.gz

Install in Peer0 of retailer:
--------------------------------

export CORE_PEER_LOCALMSPID="retailerMSP"

export CORE_PEER_TLS_ROOTCERT_FILE=${PWD}/organizations/peerOrganizations/retailer.drug.com/peers/peer0.retailer.drug.com/tls/ca.crt

export CORE_PEER_MSPCONFIGPATH=${PWD}/organizations/peerOrganizations/retailer.drug.com/users/Admin@retailer.drug.com/msp

export CORE_PEER_ADDRESS=localhost:11051
peer lifecycle chaincode install ${CC_NAME}.tar.gz

export CORE_PEER_ADDRESS=localhost:12051
peer lifecycle chaincode install ${CC_NAME}.tar.gz


Install in Peer0 of transporter:
--------------------------------

export CORE_PEER_LOCALMSPID="transporterMSP"

export CORE_PEER_TLS_ROOTCERT_FILE=${PWD}/organizations/peerOrganizations/transporter.drug.com/peers/peer0.transporter.drug.com/tls/ca.crt

export CORE_PEER_MSPCONFIGPATH=${PWD}/organizations/peerOrganizations/transporter.drug.com/users/Admin@transporter.drug.com/msp

export CORE_PEER_ADDRESS=localhost:13051

peer lifecycle chaincode install ${CC_NAME}.tar.gz

export CORE_PEER_ADDRESS=localhost:14051
peer lifecycle chaincode install ${CC_NAME}.tar.gz


Approve Chaincode:
------------------
peer lifecycle chaincode queryinstalled
export PACKAGE_ID=<copy package ID from above command's response>
pharmanet_1.0:24b52d5b21007067cf5c3904d2b45eef40a0113b3b9abd4976f13c713a04e897
export PACKAGE_ID=pharmanet_1.0:24b52d5b21007067cf5c3904d2b45eef40a0113b3b9abd4976f13c713a04e897



Approve for Manufacturer Org:
-----------------------------

export ORDERER_CA=${PWD}/organizations/ordererOrganizations/drug.com/orderers/orderer.drug.com/msp/tlscacerts/tlsca.drug.com-cert.pem

export CORE_PEER_LOCALMSPID="manufacturerMSP"

export CORE_PEER_TLS_ROOTCERT_FILE=${PWD}/organizations/peerOrganizations/manufacturer.drug.com/peers/peer0.manufacturer.drug.com/tls/ca.crt

export CORE_PEER_MSPCONFIGPATH=${PWD}/organizations/peerOrganizations/manufacturer.drug.com/users/Admin@manufacturer.drug.com/msp

export CORE_PEER_ADDRESS=localhost:7051

peer lifecycle chaincode approveformyorg -o localhost:7050 --ordererTLSHostnameOverride orderer.drug.com --tls --cafile $ORDERER_CA --channelID pharmanet3 --name ${CC_NAME} --version ${CC_VERSION} --package-id ${PACKAGE_ID} --sequence ${CC_SEQUENCE}


Approve for Distributor Org:
---------------------------

export CORE_PEER_LOCALMSPID="distributorMSP"

export CORE_PEER_TLS_ROOTCERT_FILE=${PWD}/organizations/peerOrganizations/distributor.drug.com/peers/peer0.distributor.drug.com/tls/ca.crt

export CORE_PEER_MSPCONFIGPATH=${PWD}/organizations/peerOrganizations/distributor.drug.com/users/Admin@distributor.drug.com/msp

export CORE_PEER_ADDRESS=localhost:9051

peer lifecycle chaincode approveformyorg -o localhost:7050 --ordererTLSHostnameOverride orderer.drug.com --tls --cafile $ORDERER_CA --channelID pharmanet3 --name ${CC_NAME} --version ${CC_VERSION} --package-id ${PACKAGE_ID} --sequence ${CC_SEQUENCE}


Approve for Retailer Org:
---------------------------
export CORE_PEER_LOCALMSPID="retailerMSP"

export CORE_PEER_TLS_ROOTCERT_FILE=${PWD}/organizations/peerOrganizations/retailer.drug.com/peers/peer0.retailer.drug.com/tls/ca.crt

export CORE_PEER_MSPCONFIGPATH=${PWD}/organizations/peerOrganizations/retailer.drug.com/users/Admin@retailer.drug.com/msp

export CORE_PEER_ADDRESS=localhost:11051

peer lifecycle chaincode approveformyorg -o localhost:7050 --ordererTLSHostnameOverride orderer.drug.com --tls --cafile $ORDERER_CA --channelID pharmanet3 --name ${CC_NAME} --version ${CC_VERSION} --package-id ${PACKAGE_ID} --sequence ${CC_SEQUENCE}

Approve for Transporter Org:
---------------------------

export CORE_PEER_LOCALMSPID="transporterMSP"

export CORE_PEER_TLS_ROOTCERT_FILE=${PWD}/organizations/peerOrganizations/transporter.drug.com/peers/peer0.transporter.drug.com/tls/ca.crt

export CORE_PEER_MSPCONFIGPATH=${PWD}/organizations/peerOrganizations/transporter.drug.com/users/Admin@transporter.drug.com/msp

export CORE_PEER_ADDRESS=localhost:13051

peer lifecycle chaincode approveformyorg -o localhost:7050 --ordererTLSHostnameOverride orderer.drug.com --tls --cafile $ORDERER_CA --channelID pharmanet3 --name ${CC_NAME} --version ${CC_VERSION} --package-id ${PACKAGE_ID} --sequence ${CC_SEQUENCE}

Check commit readiness:
-----------------------

peer lifecycle chaincode checkcommitreadiness --channelID pharmanet3 --name ${CC_NAME} --version ${CC_VERSION} --sequence ${CC_SEQUENCE} --output json


Commit:
--------


peer lifecycle chaincode commit -o localhost:7050 --ordererTLSHostnameOverride orderer.drug.com --tls --cafile $ORDERER_CA --channelID pharmanet3 --name ${CC_NAME} --peerAddresses localhost:7051 --tlsRootCertFiles ${PWD}/organizations/peerOrganizations/manufacturer.drug.com/peers/peer0.manufacturer.drug.com/tls/ca.crt --peerAddresses localhost:9051 --tlsRootCertFiles ${PWD}/organizations/peerOrganizations/distributor.drug.com/peers/peer0.distributor.drug.com/tls/ca.crt --peerAddresses localhost:11051 --tlsRootCertFiles ${PWD}/organizations/peerOrganizations/retailer.drug.com/peers/peer0.retailer.drug.com/tls/ca.crt --peerAddresses localhost:13051 --tlsRootCertFiles ${PWD}/organizations/peerOrganizations/transporter.drug.com/peers/peer0.transporter.drug.com/tls/ca.crt --version ${CC_VERSION} --sequence ${CC_SEQUENCE}


Query Committed:
----------------

peer lifecycle chaincode querycommitted --channelID pharmanet3 --name ${CC_NAME}

Commands to invoke functions:
----------------------------

peer chaincode invoke -o localhost:7050 -C pharmanet3 -n pharmanet -c '{"function":"pharmanet:registerCompany","Args":["CRN001","CompName01","Pune","Manufacturer"]}' --tls --cafile $ORDERER_CA

peer chaincode invoke -o localhost:7050 -C pharmanet3 -n pharmanet -c '{"function":"pharmanet:getCompanyDetails","Args":["CRN001","CompName01"]}' --tls --cafile $ORDERER_CA


peer chaincode invoke -o localhost:7050 -C pharmanet3 -n pharmanet -c '{"function":"pharmanet:registerCompany","Args":["CRN001","CompName01","Pune","Manufacturer"]}' --tls --cafile $ORDERER_CA

peer chaincode invoke -o localhost:7050 -C pharmanet3 -n pharmanet -c '{"function":"pharmanet:getCompanyDetails","Args":["CRN0099","CompName099"]}' --tls --cafile $ORDERER_CA

peer chaincode invoke -o localhost:7050 -C pharmanet3 -n pharmanet -c '{"function":"pharmanet:registerCompany","Args":["CRN002","CompName02","Mumbai","Manufacturer"]}' --tls --cafile $ORDERER_CA


peer chaincode invoke -o localhost:7050 -C pharmanet3 -n pharmanet -c '{"function":"pharmanet:registerCompany","Args":["CRN003","CompName03","Bangalore","Distributor"]}' --tls --cafile $ORDERER_CA


peer chaincode invoke -o localhost:7050 -C pharmanet3 -n pharmanet -c '{"function":"pharmanet:registerCompany","Args":["CRN004","CompName04","Chennai","Retailer"]}' --tls --cafile $ORDERER_CA

peer chaincode invoke -o localhost:7050 -C pharmanet3 -n pharmanet -c '{"function":"pharmanet:registerCompany","Args":["CRN005","CompName05","All India","Transporter"]}' --tls --cafile $ORDERER_CA


peer chaincode invoke -o localhost:7050 -C pharmanet3 -n pharmanet -c '{"function":"pharmanet:addDrug","Args":["DRG01","SE01","2023-01-21", "2024-01-21", "CRN001"]}' --tls --cafile $ORDERER_CA

peer chaincode invoke -o localhost:7050 -C pharmanet3 -n pharmanet -c '{"function":"pharmanet:createPO","Args":["CRN003","CRN001","DRG01", "3"]}' --tls --cafile $ORDERER_CA


peer chaincode invoke -o localhost:7050 -C pharmanet3 -n pharmanet -c '{"function":"pharmanet:createShipment","Args":["CRN003","DRG01","CRN005", "DRG01,DRG01,DRG01"]}' --tls --cafile $ORDERER_CA


peer chaincode invoke -o localhost:7050 -C pharmanet3 -n pharmanet -c '{"function":"pharmanet:updateShipment","Args":["CRN003","DRG01","CRN005"]}' --tls --cafile $ORDERER_CA


peer chaincode invoke -o localhost:7050 -C pharmanet3 -n pharmanet -c '{"function":"pharmanet:createPO","Args":["CRN004","CRN003","DRG01", "3"]}' --tls --cafile $ORDERER_CA

peer chaincode invoke -o localhost:7050 -C pharmanet3 -n pharmanet -c '{"function":"pharmanet:createShipment","Args":["CRN004","DRG01","CRN005", "DRG01,DRG01,DRG01"]}' --tls --cafile $ORDERER_CA


peer chaincode invoke -o localhost:7050 -C pharmanet3 -n pharmanet -c '{"function":"pharmanet:updateShipment","Args":["CRN004","DRG01","CRN005"]}' --tls --cafile $ORDERER_CA



peer chaincode invoke -o localhost:7050 -C pharmanet3 -n pharmanet -c '{"function":"pharmanet:retailDrug","Args":["DRG01","SE01","CRN004", "Aadhar001"]}' --tls --cafile $ORDERER_CA

peer chaincode invoke -o localhost:7050 -C pharmanet3 -n pharmanet -c '{"function":"pharmanet:viewDrugCurrentState","Args":["DRG01","SE01"]}' --tls --cafile $ORDERER_CA

peer chaincode invoke -o localhost:7050 -C pharmanet3 -n pharmanet -c '{"function":"pharmanet:viewHistory","Args":["DRG01","SE01"]}' --tls --cafile $ORDERER_CA