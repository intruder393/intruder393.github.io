window.onload = () => {
	const buttonUSB = document.getElementById('pair-usb');
	const buttonBTE = document.getElementById('pair-bte');
	const buttonPrint = document.getElementById('print-img');
	const deviceName = document.getElementById("device-name");

	const ESC_CHAR = 27;
	const LINE_FEED = 10;
	const INIT_PRINTER = new Uint8Array([ESC_CHAR, 60]);
	const SELECT_BIT_IMAGE_MODE = new Uint8Array([ESC_CHAR, 42, 33]);
	const SET_LINE_SPACE_24 = new Uint8Array([ESC_CHAR, 51, 24]);
	const SET_LINE_SPACE_30 = new Uint8Array([ESC_CHAR, 51, 30]);

	let device = null;
	// let deviceFilter = {vendorId: 0x0dd4};
	let deviceFilter = {};
	let canvas = document.getElementById("ctx-print"),
		w = 297, h = 730,
		canvasData = [], imageData = [];
	canvas.w = w;
	canvas.h = h;

	let ctx = canvas.getContext("2d");
	let img = document.getElementById("img-orig");
	ctx.drawImage(img, 0, 0);
	canvasData = ctx.getImageData(0, 0, w, h).data;

	buttonUSB.addEventListener('pointerup', (event) => {
		//todo:
		navigator.usb.requestDevice({
			filters: [ deviceFilter ]
		})
		.then(selectedDevice => {
			device = selectedDevice;
			deviceName.innerText = device.productName;
			return device.open();
		})
		.then(() => {
			return device.selectConfiguration(1);
		})
		.then(() => {
			return device.claimInterface(device.configuration.interfaces[0].interfaceNumber);
		})
		.catch(function(e) {
			console.error('USB failed!', e.message);
		});
	});

	buttonBTE.addEventListener('pointerup', (event) => {
		navigator.bluetooth.requestDevice({
			// filters: [{ deviceFilter }],
			acceptAllDevices: true
		})
		.then((selectedDevice) => {
			device = selectedDevice;
			deviceName.innerText = device.productName;
			return device.gatt.connect();
		})
		.then((server) => {
			return server.getPrimaryService("0000110b-0000-1000-8000-00805f9b34fb");
		})
		.catch((e) => {
			console.log('Connection failed!', e.message);
		});
	});

	buttonPrint.addEventListener('pointerup', async event => {
		await printImage().catch(error => {
			console.error('Error when printing!', error.message);
		});
	});

	async function printImage() {
		await prepareImageData();

		let widthLSB = w & 0xff;
		let widthMSB = (w >> 8) & 0xff || 1;
		let imgBitMode = await buildCommand(SELECT_BIT_IMAGE_MODE, [widthLSB, widthMSB]);
		let dpi = 24;
		let bitePerSlice = dpi / 8;

		await sendBytes(INIT_PRINTER);

		// Set the line spacing to 24 dots, the height of each "stripe" of the
		// image that we're drawing. If we don't do this, and we need to
		// draw the bitmap in multiple passes, then we'll end up with some
		// whitespace between slices of the image since the default line
		// height--how much the printer moves on a newline--is 30 dots.
		await sendBytes(SET_LINE_SPACE_24);

		let offset = 0;
		while (offset < h) {
			let imageDataLineIndex = 0;
			let dataLine = [];

			for (let x = 0; x < w; x++) {
				// Remember, 24 dots = 24 bits = 3 bytes.
				// The 'k' variable keeps track of which of those
				// three bytes that we're currently scribbling into.
				for (let k = 0; k < bitePerSlice; k++) {
					let slice = 0;

					// A byte is 8 bits. The 'b' variable keeps track
					// of which bit in the byte we're recording.
					for (let b = 0; b < 8; b++) {
						// Calculate the y position that we're currently
						// trying to draw. We take our offset, divide it
						// by 8 so we're talking about the y offset in
						// terms of bytes, add our current 'k' byte
						// offset to that, multiple by 8 to get it in terms
						// of bits again, and add our bit offset to it.
						let y = (((offset / 8) + k) * 8) + b;

						// Calculate the location of the pixel we want in the bit array.
						// It'll be at (y * width) + x.
						let i = (y * w) + x;

						// If the image (or this stripe of the image)
						// is shorter than 24 dots, pad with zero.
						let v = 0;
						if (i < imageData.length) {
							v = imageData[i];
						}

						// Finally, store our bit in the byte that we're currently
						// scribbling to. Our current 'b' is actually the exact
						// opposite of where we want it to be in the byte, so
						// subtract it from 7, shift our bit into place in a temp
						// byte, and OR it with the target byte to get it into there.
						slice |= (v ? 1 : 0) << (7 - b);
					}

					dataLine[imageDataLineIndex + k] = slice;
				}

				imageDataLineIndex += bitePerSlice;
			}

			let prLine = await buildCommand(imgBitMode, dataLine);
			await sendBytes(prLine);

			// We're done with this 24-dot high pass. Render a newline
			// to bump the print head down to the next line
			// and keep on trucking.
			offset += dpi;
			await sendBytes(new Uint8Array([LINE_FEED]));
		}

		// Restore the line spacing to the default of 30 dots.
		await sendBytes(SET_LINE_SPACE_30);
		await sendBytes(new Uint8Array([LINE_FEED]));
	}

	async function prepareImageData() {
		//      |  0  |  1  |  2  |  3  |
		//      |  4  |  5  |  6  |  7  |
		//      |  8  |  9  |  10 |  11 |
		//      | 12  |  13 |  14 |  15 |

		//to bitArray like this  | 0 | 1 | 2 | 3 | 4 | 5 | ... | 15 |

		let index = 0;
		for (let row = 0; row < canvasData.length; row += 4) {
			//RGBA
			let luminance = parseInt(canvasData[row] * 0.3 + canvasData[row + 1] * 0.59 + canvasData[row + 2] * 0.11);
			imageData[index] = luminance < 127 ? 1 : 0;
			index++;
		}

		return true;
	}

	async function buildCommand(command, params) {
		return new Uint8Array([command + params]);
	}

	async function sendBytes(bytes) {
		return await device.transferOut(2, bytes).catch(error => {
			console.log('Sending error! ', error.message);
		});
	}

};