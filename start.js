import path from "node:path";

import dotenv from "dotenv-flow";
import fs from "fs-extra";
import ydc from "ydc";

import Application from "./app/Application.js";
import KeePassDBManager from "./components/KeePassDBManager.js";
import service from "./service/windows/service.js";
import TelegramBotManager from "./components/TelegramBotManager.js";

dotenv.config();

await ydc();

const CWD = path.resolve(process.cwd());

const { name, version } = fs.readJsonSync(path.join(CWD, "package.json"));

class AppManager extends Application {
	constructor() {
		super();

		this.addComponent(new KeePassDBManager(this));
		this.addComponent(new TelegramBotManager(this));
	}

	get isDevelopment() {
		return process.env.DEVELOPER_ENVIRONMENT === "true";
	}

	async initialize() {
		console.log(`${name} v${version}`);

		if (this.isDevelopment) console.log("isDevelopment");

		await super.initialize();
	}

	async quit(code = 0) {
		if (!this.isDevelopment) {
			await new Promise(resolve => {
				service.once("uninstall", resolve);

				service.uninstall();
			});
		}

		await super.quit(code);
	}
}

const app = new AppManager();
await app.initialize();
await app.run();
