# webusb-driver
WebUSB driver for Ledger Nano S/X. 


    let ports = await WebUSB.getPorts();

    // browser dialogue
    WebUSB.requestPort()
        .then(async selectedPort => { 
            selectedPort.onReceive = handleUsbReceive; // write your own
            selectedPort.onReceiveError = handleUsbError; // write your own
            selectedPort.connect()
                .then(() => {
                    console.log("connected to: ", WebUSB.connectedDevice);
                })
                .catch((e) => {
                    console.log("connect error: ", e);
                });
        })
        .catch((e) => { 
            console.log('USB device not found.') 
        });
