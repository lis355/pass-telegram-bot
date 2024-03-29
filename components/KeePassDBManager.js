/* eslint-disable no-unused-vars */

const kdbxweb = require("kdbxweb");
const axios = require("axios");

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
};

class YandexDiskLocalDBProvider extends DBProvider {
	async getDB() {
		const credentials = new kdbxweb.Credentials();
		if (process.env.YANDEX_DISK_LOCAL_KEEPASS_DB_MASTER_PASSWORD) await credentials.setPassword(kdbxweb.ProtectedValue.fromString(process.env.YANDEX_DISK_LOCAL_KEEPASS_DB_MASTER_PASSWORD));
		if (process.env.YANDEX_DISK_LOCAL_KEEPASS_DB_KEY_FILE_PATH) await credentials.setKeyFile(app.fs.readFileSync(process.env.YANDEX_DISK_LOCAL_KEEPASS_DB_KEY_FILE_PATH));

		const kdbxFileData = app.fs.readFileSync(process.env.YANDEX_DISK_LOCAL_KEEPASS_DB_FILE_PATH);
		const db = await kdbxweb.Kdbx.load(new Uint8Array(kdbxFileData).buffer, credentials);

		return db;
	}
};

module.exports = class KeePassDBManager extends ndapp.ApplicationComponent {
	async initialize() {
		await super.initialize();

		await this.loadDB();
	}

	async loadDB() {
		const dbProvider = process.env.YANDEX_DISK_USE_REMOTE === "true" ? new YandexDiskRemoteDBProvider() : new YandexDiskLocalDBProvider();

		this.db = await dbProvider.getDB();

		app.log.info(`KeePassDB: loaded with ${dbProvider.constructor.name}`);
	}

	searchEntries(pattern) {
		const patternInLowerCase = pattern.toLowerCase();

		this.searchedEntries = [];

		this.subSearchEntriesInGroup(this.db.getDefaultGroup().entries, patternInLowerCase);

		for (const group of this.db.getDefaultGroup().groups) {
			if (group.name === "Recycle Bin") continue;

			this.subSearchEntriesInGroup(group.entries, patternInLowerCase);
		}

		app.log.info(`KeePassDB: searchedEntries ${this.searchedEntries.length} with pattern ${pattern}`);

		return this.searchedEntries;
	}

	subSearchEntriesInGroup(entries, patternInLowerCase) {
		for (const entry of entries) {
			const title = entry.fields.get("Title");

			if (title.toLowerCase().includes(patternInLowerCase)) this.searchedEntries.push(entry);
		}
	}
};
