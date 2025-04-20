import axios from "axios";
import fs from "fs-extra";
import kdbxweb from "kdbxweb";

import ApplicationComponent from "../app/ApplicationComponent.js";

class KeePassDBProvider {
	async loadDb() { }
	async saveDb(db) { }
}

// https://yandex.ru/dev/disk-api/doc/ru/concepts/quickstart#quickstart__oauth
class YandexDiskRemoteDBProvider extends KeePassDBProvider {
	#baseURL = "https://cloud-api.yandex.net/v1/disk/";

	async #downloadFile(yandexDiskFilePath) {
		// https://yandex.ru/dev/disk-api/doc/ru/reference/content

		const resourcesDownloadResponse = await this.request({
			url: "resources/download",
			method: "GET",
			params: {
				path: yandexDiskFilePath
			}
		});

		const downloadResponse = await axios({
			url: resourcesDownloadResponse.data.href,
			method: resourcesDownloadResponse.data.method,
			responseType: "arraybuffer"
		});

		return downloadResponse.data;
	}

	async #uploadFile(yandexDiskFilePath, fileData) {
		// https://yandex.ru/dev/disk-api/doc/ru/reference/upload

		const resourcesUploadResponse = await this.request({
			url: "resources/upload",
			method: "GET",
			params: {
				path: yandexDiskFilePath,
				overwrite: true
			}
		});

		// const uploadResponse =
		await axios({
			url: resourcesUploadResponse.data.href,
			method: resourcesUploadResponse.data.method,
			data: fileData
		});
	}

	async loadDb() {
		this.request = axios.create({
			baseURL: this.#baseURL,
			headers: {
				"authorization": "OAuth " + process.env.YANDEX_DISK_OAUTH_TOKEN
			}
		});

		this.request.interceptors.response.use(
			response => {
				return response;
			},
			error => {
				console.error(JSON.stringify(error.response.data));

				return Promise.reject(error);
			}
		);

		const credentials = new kdbxweb.Credentials();
		if (process.env.YANDEX_DISK_KEEPASS_DB_MASTER_PASSWORD) await credentials.setPassword(kdbxweb.ProtectedValue.fromString(process.env.YANDEX_DISK_KEEPASS_DB_MASTER_PASSWORD));
		if (process.env.YANDEX_DISK_KEEPASS_DB_KEY_FILE_PATH) {
			const keyFileData = await this.#downloadFile(process.env.YANDEX_DISK_KEEPASS_DB_KEY_FILE_PATH);
			await credentials.setKeyFile(keyFileData);
		}

		const kdbxFileData = await this.#downloadFile(process.env.YANDEX_DISK_KEEPASS_DB_FILE_PATH);
		const db = await kdbxweb.Kdbx.load(new Uint8Array(kdbxFileData).buffer, credentials);

		return db;
	}

	async saveDb(db) {
		const kdbxFileData = await db.save();

		await this.#uploadFile(process.env.YANDEX_DISK_KEEPASS_DB_FILE_PATH, new Uint8Array(kdbxFileData));
	}
}

class YandexDiskLocalDBProvider extends KeePassDBProvider {
	async loadDb() {
		const credentials = new kdbxweb.Credentials();
		if (process.env.YANDEX_DISK_LOCAL_KEEPASS_DB_MASTER_PASSWORD) await credentials.setPassword(kdbxweb.ProtectedValue.fromString(process.env.YANDEX_DISK_LOCAL_KEEPASS_DB_MASTER_PASSWORD));
		if (process.env.YANDEX_DISK_LOCAL_KEEPASS_DB_KEY_FILE_PATH) await credentials.setKeyFile(fs.readFileSync(process.env.YANDEX_DISK_LOCAL_KEEPASS_DB_KEY_FILE_PATH));

		const kdbxFileData = fs.readFileSync(process.env.YANDEX_DISK_LOCAL_KEEPASS_DB_FILE_PATH);
		const db = await kdbxweb.Kdbx.load(new Uint8Array(kdbxFileData).buffer, credentials);

		return db;
	}

	async saveDb(db) {
		const kdbxFileData = await db.save();

		fs.writeFileSync(process.env.YANDEX_DISK_LOCAL_KEEPASS_DB_FILE_PATH, new Uint8Array(kdbxFileData));
	}
}

export default class KeePassDBManager extends ApplicationComponent {
	#dbProvider;
	#db;

	async initialize() {
		await super.initialize();

		await this.#loadDb();
	}

	async #loadDb() {
		this.#dbProvider = process.env.YANDEX_DISK_USE_REMOTE === "true"
			? new YandexDiskRemoteDBProvider()
			: new YandexDiskLocalDBProvider();

		this.#db = await this.#dbProvider.loadDb();

		this.#db.cleanup({
			historyRules: true,
			customIcons: true,
			binaries: true
		});

		this.#db.upgrade();

		console.log(`[KeePassDB]: loaded with ${this.#dbProvider.constructor.name}`);
	}

	async reloadDb() {
		await this.#loadDb();
	}

	async saveDb() {
		await this.#dbProvider.saveDb(this.#db);

		console.log(`[KeePassDB]: saved with ${this.#dbProvider.constructor.name}`);
	}

	#recursiveVisitGroup(group, visitor) {
		const result = visitor(group);
		if (result &&
			result.stop) return;

		for (const childGroup of group.groups) {
			if (childGroup.uuid.equals(this.#db.meta.recycleBinUuid)) continue;

			this.#recursiveVisitGroup(childGroup, visitor);
		}
	}

	searchEntries(pattern) {
		const patternsInLowerCase = pattern.split(" ")
			.map(s => s.trim().toLowerCase())

			.map(s =>
				s.startsWith("(") &&
					s.endsWith(")")
					? s.substring(1, s.length - 1)
					: s
			)
			.filter(Boolean);

		const searchEntriesResult = {
			entries: []
		};

		this.#recursiveVisitGroup(this.#db.getDefaultGroup(), group => {
			const groupNameInLowerCase = group.name.toLowerCase();

			for (const entry of group.entries) {
				const titleInLowerCase = entry.fields.get("Title").toLowerCase();

				const isMatch = patternsInLowerCase
					.every(patternInLowerCase => {
						if (groupNameInLowerCase.includes(patternInLowerCase)) return true;

						if (titleInLowerCase.includes(patternInLowerCase)) return true;

						return false;
					});

				if (isMatch) searchEntriesResult.entries.push(entry);
			}
		});

		console.log(`[KeePassDB]: searchedEntries ${searchEntriesResult.entries.length} with pattern ${pattern}`);

		return searchEntriesResult;
	}

	searchEntryByUuid(uuidString) {
		let result;

		this.#recursiveVisitGroup(this.#db.getDefaultGroup(), group => {
			for (const entry of group.entries) {
				if (entry.uuid.equals(uuidString)) {
					result = entry;

					return { stop: true };
				}
			}
		});

		return result;
	}

	getAllGroups() {
		const groups = [];

		this.#recursiveVisitGroup(this.#db.getDefaultGroup(), group => {
			groups.push(group);
		});

		return groups;
	}

	getGroupByName(groupName) {
		let result;

		this.#recursiveVisitGroup(this.#db.getDefaultGroup(), group => {
			if (group.name === groupName) {
				result = group;

				return { stop: true };
			}
		});

		return result;
	}

	createEntry(group, title, username, password, comments) {
		const entry = this.#db.createEntry(group);
		entry.fields.set("Title", title);
		entry.fields.set("UserName", username);
		entry.fields.set("Password", password);
		entry.fields.set("Notes", comments);

		console.log(`[KeePassDB]: enry ${title} in group ${group.name} created`);

		return entry;
	}
}
