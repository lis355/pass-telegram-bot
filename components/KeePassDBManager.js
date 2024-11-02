import axios from "axios";
import fs from "fs-extra";
import kdbxweb from "kdbxweb";

import ApplicationComponent from "../app/ApplicationComponent.js";

class DBProvider {
	async getDB() { }
}

class YandexDiskRemoteDBProvider extends DBProvider {
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

class YandexDiskLocalDBProvider extends DBProvider {
	async getDB() {
		const credentials = new kdbxweb.Credentials();
		if (process.env.YANDEX_DISK_LOCAL_KEEPASS_DB_MASTER_PASSWORD) await credentials.setPassword(kdbxweb.ProtectedValue.fromString(process.env.YANDEX_DISK_LOCAL_KEEPASS_DB_MASTER_PASSWORD));
		if (process.env.YANDEX_DISK_LOCAL_KEEPASS_DB_KEY_FILE_PATH) await credentials.setKeyFile(fs.readFileSync(process.env.YANDEX_DISK_LOCAL_KEEPASS_DB_KEY_FILE_PATH));

		const kdbxFileData = fs.readFileSync(process.env.YANDEX_DISK_LOCAL_KEEPASS_DB_FILE_PATH);
		const db = await kdbxweb.Kdbx.load(new Uint8Array(kdbxFileData).buffer, credentials);

		return db;
	}
}

export default class KeePassDBManager extends ApplicationComponent {
	async initialize() {
		await super.initialize();

		await this.loadDB();

		this.searchEntries("Gmail");
		this.searchEntries("Gmail (ALL)");
	}

	async loadDB() {
		const dbProvider = process.env.YANDEX_DISK_USE_REMOTE === "true" ? new YandexDiskRemoteDBProvider() : new YandexDiskLocalDBProvider();

		this.db = await dbProvider.getDB();

		console.log(`KeePassDB: loaded with ${dbProvider.constructor.name}`);
	}

	searchEntries(pattern) {
		const patternInLowerCase = pattern.toLowerCase();

		const searchEntriesResult = {
			entries: []
		};

		this.recursiveSearchEntriesInGroup(searchEntriesResult, this.db.getDefaultGroup(), patternInLowerCase);

		console.log(`KeePassDB: searchedEntries ${searchEntriesResult.entries.length} with pattern ${pattern}`);

		return searchEntriesResult;
	}

	recursiveSearchEntriesInGroup(searchEntriesResult, group, patternInLowerCase) {
		const groupNameInLowerCase = group.name.toLowerCase();

		for (const entry of group.entries) {
			const titleInLowerCase = entry.fields.get("Title").toLowerCase();

			if (groupNameInLowerCase.includes(patternInLowerCase) ||
				patternInLowerCase.includes(groupNameInLowerCase) ||
				titleInLowerCase.toLowerCase().includes(patternInLowerCase) ||
				patternInLowerCase.includes(titleInLowerCase)) searchEntriesResult.entries.push(entry);
		}

		for (const childGroup of group.groups) {
			if (childGroup.name === "Recycle Bin") continue;

			this.recursiveSearchEntriesInGroup(searchEntriesResult, childGroup, patternInLowerCase);
		}
	}
}
