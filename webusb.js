import EscPosEncoder from 'esc-pos-encoder';

window.onload = () => {
	const buttonUSB = document.querySelector('#pair-usb');

	let device = null;
	let deviceFilter = {};

	buttonUSB.onclick = () => {
		navigator.usb.requestDevice({filters: [ deviceFilter ]})
		.then(selectedDevice => {
			device = selectedDevice;
			console.log(device);
			return device.open();
		})
		.then(() => device.selectConfiguration(1))
		.then(() => device.claimInterface(device.configuration.interfaces[0].interfaceNumber))
		.catch(e => {
			console.error('Error!', e.message);
		});
	};
};