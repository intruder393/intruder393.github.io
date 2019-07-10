import EscPosEncoder from 'esc-pos-encoder';

window.onload = () => {
	const buttonUSB = document.querySelector('#pair-usb');

	let device = null;
	let deviceFilter = {};

	buttonUSB.onclick = () => {
		const encoder = new EscPosEncoder();
		console.log(encoder);

		navigator.usb.requestDevice({filters: [deviceFilter]})
			.then((selectedDevice) => {
				device = selectedDevice;
				console.log(device);
				return device.open();
			})
			.then(() => device.selectConfiguration(1))
			.then(() => device.claimInterface(device.configuration.interfaces[0].interfaceNumber))
			// .then(() => device.controlTransferOut({
			// 	requestType: 'class',
			// 	recipient: 'interface',
			// 	request: 0x22,
			// 	value: 0x01,
			// 	index: device.configuration.interfaces[0].interfaceNumber
			// })) // Ready to receive data
			.then(() => {
				let image = new Image();
				console.log(device);
				image.onload = () => {
					let result = encoder
						.initialize()
						// .image(image, 297, 730, 'bayer')
						.image(image, 408, 1008, 'bayer')
						.encode();

					console.log(result);
					device.transferOut(1, result).catch(error => {
						console.log('Sending error! ', error.message);
					});
				};
				// image.src = '/upload/cat_384.png';
				image.src = '/img/ticket-1_408x1008.png';
			})
			.catch(function(e) {
				console.error('USB failed!', e.message);
			});
	};
};