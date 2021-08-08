'use strict';
var WebUSB = (function () {
    let wusb = {
        interfaceNumber: null,
        isDisconnecting: false,
        supportedHardware: {
            11415: {
                "Ledger": {
                    4117: "Nano S",
                    16405: "Nano X"
                }
            },
        },
        connectedDevice: {},
        customInitMethods:{
            "Nano S": function() {}, // override from outside this module
            "Nano X": function() {} // override from outside this module
        },
        onReceive: function(data){}, // override from outside this module
        onReceiveError: function(error){} // override from outside this module
    };

    wusb.getPorts = function() {
        wusb.isDisconnecting = false;
        return navigator.usb.getDevices().then(usbDevices => {
            return usbDevices.map(usbDevice => new wusb.Port(usbDevice));
        });
    };

    wusb.requestPort = function() {
        let supportedHWFilters = [];
        Object.keys(wusb.supportedHardware).map(vendorId => {
            Object.keys(wusb.supportedHardware[vendorId]).map(vendorName => {
                Object.keys(wusb.supportedHardware[vendorId][vendorName]).map(productId => {
                    supportedHWFilters.push({
                        "vendorId": vendorId,
                        "productId": productId
                    })
                })
            })
        });
        return navigator.usb.requestDevice({ 'filters': supportedHWFilters }).then(
            usbDevice => new wusb.Port(usbDevice)
        );
    };

    wusb.Port = function(usbDevice) {
        this.__device = usbDevice;
    };

    wusb.Port.prototype.connect = function() {
        let readLoop = () => {
            this.__device.transferIn(this.endpointIn_, 64)
                .then(result => {
                    this.onReceive(result.data);
                    if(!wusb.isDisconnecting) readLoop();
                }, error => {
                    // when in and out endpoints match!
                    // Readloop error: NetworkError: A transfer error has occurred.
                    // Readloop error: AbortError: The transfer was cancelled. 
                    console.log('Readloop error: ', error);
                    //console.log('endpointIn_:', this.endpointIn_);
                    //console.log('endpointOut_:', this.endpointOut_);

                    // when using non-existing endpoint
                    // NotFoundError: The specified endpoint is not part of a claimed and selected alternate interface.
                    if(!wusb.isDisconnecting) this.onReceiveError(error);
                });
        };

        return this.__device.open()
            .then(() => {
                wusb.connectedDevice.hostName = this.__device.productName;
                wusb.connectedDevice.vendorName = Object.keys(wusb.supportedHardware[this.__device.vendorId])[0];
                wusb.connectedDevice.chip = wusb.supportedHardware[this.__device.vendorId][wusb.connectedDevice.vendorName][this.__device.productId];
                wusb.connectedDevice.serialNumber = this.__device.serialNumber;
                wusb.connectedDevice.manufacturerName = this.__device.manufacturerName;
               
                if (this.__device.configuration === null) {
                    return this.__device.selectConfiguration(1);
                }
            })
            .then(() => {
                let configInterfaces = this.__device.configuration.interfaces;
                configInterfaces.forEach(element => {
                    element.alternates.forEach(elementalt => {
                        if (elementalt.interfaceClass === 0xff) {
                            this.interfaceNumber_ = element.interfaceNumber;
                            elementalt.endpoints.forEach(elementendpoint => {
                                if (elementendpoint.direction === "out" && elementendpoint.type === "interrupt") {
                                    this.endpointOut_ = elementendpoint.endpointNumber;
                                    this.endpointOutPacketSize_ = elementendpoint.packetSize;
                                }
                                if (elementendpoint.direction === "in" && elementendpoint.type === "interrupt") {
                                    this.endpointIn_ = elementendpoint.endpointNumber;
                                    this.endpointInPacketSize_ = elementendpoint.packetSize;
                                }
                            })
                        }
                    })
                })
                wusb.interfaceNumber = this.interfaceNumber_;
            })
            .then(() => this.__device.claimInterface(this.interfaceNumber_))
            .then(() => this.__device.selectAlternateInterface(this.interfaceNumber_, 0))
            .then(() => wusb.customInitMethods[wusb.connectedDevice.chip](this))
            .then(() => {
                readLoop();
            })
    };

    wusb.Port.prototype.send = async function(data) {
        if (wusb.isDisconnecting){
            return
        }
        if (!this.endpointOut_){
            console.log("Endpoint missing on send().", this.endpointOut_);
            return
        }
        if(data.length==64){
            return await this.__device.transferOut(this.endpointOut_, data);
        }else{
            console.log('Wrong data length ('+data.length+') for send().');
        }
    };

    wusb.Port.prototype.disconnect = async function() {
        if (!wusb.isDisconnecting){
            wusb.isDisconnecting = true;
            await this.__device.releaseInterface(0);
            await this.__device.releaseInterface(wusb.interfaceNumber);
            this.__device.close();
        }
    };

    return wusb;
}());
