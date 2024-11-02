import axios from "axios";
import fs from "fs-extra";
import kdbxweb from "kdbxweb";

import ApplicationComponent from "../app/ApplicationComponent.js";

class KeePassDBProvider {
	async getDB() { }
}

class YandexDiskRemoteDBProvider extends KeePassDBProvider {
	async getDB() {
		this.request = axios.create({
			baseURL: "https://cloud-api.yandex.net/v1/disk/",
			headers: {
				"authorization": "OAuth " + process.env.YANDEX_DISK_OAUTH_TOKEN
			}
		});

		const credentials = new kdbxweb.Credentials();
		if (process.env.YANDEX_DISK_KEEPASS_DB_MASTER_PASSWORD) await credentials.setPassword(kdbxweb.ProtectedValue.fromString(process.env.YANDEX_DISK_KEEPASS_DB_MASTER_PASSWORD));
		if (process.env.YANDEX_DISK_KEEPASS_DB_KEY_FILE_PATH) {
			const keyFileData = await this.downloadFile(process.env.YANDEX_DISK_KEEPASS_DB_KEY_FILE_PATH);
			await credentials.setKeyFile(keyFileData);
		}

		const kdbxFileData = await this.downloadFile(process.env.YANDEX_DISK_KEEPASS_DB_FILE_PATH);
		const db = await kdbxweb.Kdbx.load(new Uint8Array(kdbxFileData).buffer, credentials);

		return db;
	}

	async downloadFile(yandexDiskFilePath) {
		const fileInfoResponse = await this.infoRequest(yandexDiskFilePath);
		if (fileInfoResponse.path) {
			const response = await axios.get(fileInfoResponse.file, {
				responseType: "arraybuffer"
			});

			return response.data;
		}

		return null;
	}

	async infoRequest(path) {
		try {
			const response = await this.request.get("resources", {
				params: {
					path
				}
			});

			return response.data;
		} catch (error) {
			if (error.response &&
				error.response.status === 404) {
				return { path: null };
			} else {
				throw error;
			}
		}
	}
}

class YandexDiskLocalDBProvider extends KeePassDBProvider {
	async getDB() {
		const credentials = new kdbxweb.Credentials();
		if (process.env.YANDEX_DISK_LOCAL_KEEPASS_DB_MASTER_PASSWORD) await credentials.setPassword(kdbxweb.ProtectedValue.fromString(process.env.YANDEX_DISK_LOCAL_KEEPASS_DB_MASTER_PASSWORD));
		if (process.env.YANDEX_DISK_LOCAL_KEEPASS_DB_KEY_FILE_PATH) await credentials.setKeyFile(fs.readFileSync(process.env.YANDEX_DISK_LOCAL_KEEPASS_DB_KEY_FILE_PATH));

		const kdbxFileData = fs.readFileSync(process.env.YANDEX_DISK_LOCAL_KEEPASS_DB_FILE_PATH);
		const db = await kdbxweb.Kdbx.load(new Uint8Array(kdbxFileData).buffer, credentials);

		return db;
	}
}

class KeePassDBSearcher {
	#db;

	constructor(db) {
		this.#db = db;
	}

	#recursiveVisitGroup(group, visitor) {
		const result = visitor(group);
		if (result &&
			result.stop) return;

		for (const childGroup of group.groups) {
			if (childGroup.name === "Recycle Bin") continue;

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
}

export default class KeePassDBManager extends ApplicationComponent {
	#keePassDBSearcher;

	async initialize() {
		await super.initialize();

		await this.#loadDB();
	}

	async #loadDB() {
		const dbProvider = process.env.YANDEX_DISK_USE_REMOTE === "true"
			? new YandexDiskRemoteDBProvider()
			: new YandexDiskLocalDBProvider();

		const db = await dbProvider.getDB();

		this.#keePassDBSearcher = new KeePassDBSearcher(db);

		console.log(`KeePassDB: loaded with ${dbProvider.constructor.name}`);
	}

	searchEntries(pattern) {
		const searchEntriesResult = this.#keePassDBSearcher.searchEntries(pattern);

		console.log(`KeePassDB: searchedEntries ${searchEntriesResult.entries.length} with pattern ${pattern}`);

		return searchEntriesResult;
	}

	searchEntryByUuid(uuidString) {
		return this.#keePassDBSearcher.searchEntryByUuid(uuidString);
	}
}
