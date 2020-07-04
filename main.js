const ndapp = require("ndapp");

const PassDB = require("./PassDB");

ndapp(async () => {
	const db = new PassDB({
		databasePath: app.path.join(process.cwd(), "db/P.kdbx"),
		keyfilePath: app.path.join(process.cwd(), "db/P.key")
	});

	await db.load();
});
