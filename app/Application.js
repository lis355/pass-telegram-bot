import EventEmitter from "events";

import _ from "lodash";

export default class Application {
	constructor() {
		this.initialized = false;

		this.events = new EventEmitter();

		this.components = [];

		process.on("uncaughtException", error => { this.onUncaughtException(error); });
		process.on("unhandledRejection", error => { this.onUnhandledRejection(error); });

		const defaultErrorHandler = error => {
			console.error(error.stack);

			this.quit();
		};

		this.onUncaughtException = defaultErrorHandler;
		this.onUnhandledRejection = defaultErrorHandler;
	}

	addComponent(component) {
		this.components.push(component);
		this[_.camelCase(component.constructor.name)] = component;
	}

	async initialize() {
		if (this.initialized) {
			console.error("Calling initialize twise or more");
		}

		for (let i = 0; i < this.components.length; i++) {
			await this.components[i].initialize();
		}

		this.initialized = true;
	}

	async run() {
		for (let i = 0; i < this.components.length; i++) {
			await this.components[i].run();
		}
	}

	async quit(code = 0) {
		for (let i = 0; i < this.components.length; i++) {
			await this.components[i].exit(code);
		}

		this.exit(code);
	}

	exit(code = 0) {
		process.exit(code);
	}
}