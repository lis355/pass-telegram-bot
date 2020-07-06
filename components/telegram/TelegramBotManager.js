const Telegraf = require("telegraf");
const session = require("telegraf/session");
const Stage = require("telegraf/stage");
const HttpsProxyAgent = require("https-proxy-agent");

const commandMiddleware = (ctx, next) => {
	const parts = ctx.message.text.split(" ");

	ctx.state.command = {
		name: parts[0].substring(1),
		arguments: parts.slice(1)
	};

	return next();
};

module.exports = class TelegramBotManager extends ndapp.ApplicationComponent {
	async initialize() {
		await super.initialize();

		if (!process.env.TELEGRAM_APIKEY) throw new Error("No telegram bot token");

		const telegramOptions = {};
		if (process.env.TELEGRAM_PROXY) {
			telegramOptions.agent = new HttpsProxyAgent(process.env.TELEGRAM_PROXY);
		}

		this.bot = new Telegraf(process.env.TELEGRAM_APIKEY, {
			telegram: telegramOptions
		});

		this.bot.catch((error, ctx) => {
			app.log.error(`Error for ${ctx.updateType}`, error);
		});

		const stage = new Stage();
		// stage.register(authScene);

		this.bot.use(session());
		this.bot.use(stage.middleware());

		this.registerCommands();

		// this.bot.on("text", ctx => ctx.reply(["Команды", "/auth - Запросить код авторизации"].join(app.os.EOL)));

		this.bot.launch();
	}

	registerCommands() {
		this.bot.command("find", commandMiddleware, async ctx => {
			// DEBUG
			return ctx.reply(this.onFindCommand(ctx.state.command.arguments[0]));
		});
	}
};
