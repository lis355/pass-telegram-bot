const path = require("node:path");

const { Service } = require("node-windows");

const { name } = require("../../package.json");

const workingDirectory = path.resolve("../..");

const svc = new Service({
	name,
	description: "",
	script: path.resolve(workingDirectory, "start.js"),
	workingDirectory
});

svc.on("install", () => {
	svc.start();
});

svc.on("alreadyinstalled", () => {
	console.log(`${svc.name} service is already installed`);
});

svc.on("invalidinstallation", () => {
	console.log(`${svc.name} service is invalid installed`);
});

svc.on("uninstall", () => {
	console.log(`${svc.name} service is uninstalled`);
});

svc.on("alreadyuninstalled", () => {
	console.log(`${svc.name} service is already uninstalled`);
});

svc.on("start", () => {
	console.log(`${svc.name} started`);
});

svc.on("stop", () => {
	console.log(`${svc.name} stopped`);
});

svc.on("error", error => {
	console.error(error);
});

module.exports = svc;
