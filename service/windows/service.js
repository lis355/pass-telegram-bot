import path from "node:path";

import fs from "fs-extra";

import { Service } from "node-windows";

const workingDirectory = path.resolve(process.cwd());

const { name } = fs.readJsonSync(path.resolve(process.cwd(), "package.json"));

const svc = new Service({
	name,
	description: "",
	script: path.join(workingDirectory, "start.js"),
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

export default svc;
