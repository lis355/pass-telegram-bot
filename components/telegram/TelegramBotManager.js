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

const DB_MESSAGES_PATH = "messages";
const MESSAGES_TIMEOUT = app.moment.duration("PT30S");

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

		await this.deleteMessages();

		this.registerCommands();

		this.bot.on("text", async ctx => {
			const responseMessage = await ctx.reply(this.findEntryCommand(ctx.message.text.trim()));

			this.processRequestAndResponceMessages(ctx.message, responseMessage);
		});

		this.bot.launch();
	}

	processRequestAndResponceMessages(requestMessage, responseMessage) {
		this.rememberMessageId(requestMessage);
		this.rememberMessageId(responseMessage);

		clearTimeout(this.deleteMessagesTimeout);
		this.deleteMessagesTimeout = setTimeout(() => this.deleteMessages(), MESSAGES_TIMEOUT);
	}

	rememberMessageId(message) {
		const messages = app.db.get(DB_MESSAGES_PATH, []).value();
		messages.push({ chatId: message.chat.id, messageId: message["message_id"] });
		app.db.set(DB_MESSAGES_PATH, messages).write();
	}

	async deleteMessages() {
		const messages = app.db.get(DB_MESSAGES_PATH, []).value();
		for (const message of messages) {
			try {
				await this.bot.telegram.deleteMessage(message.chatId, message.messageId);
			} catch (error) {
			}
		}

		app.db.unset(DB_MESSAGES_PATH).write();
	}

	// COMMANDS //

	registerCommands() {
		this.bot.command("find", commandMiddleware, async ctx => {
			const responseMessage = await ctx.reply(this.findEntryCommand(ctx.state.command.arguments[0]));

			this.processRequestAndResponceMessages(ctx.message, responseMessage);
		});
	}

	findEntryCommand(pattern) {
		const MAX_ENTRIES_IN_RESPONSE = 10;

		const foundEntries = app.dbManager.db.findEntries({ pattern });
		// app.log.info(`Found ${foundEntries.length} entries for pattern ${pattern}`);

		let response = "";

		if (foundEntries.length > 1) {
			response = `Найдено ${foundEntries.length} записей` + app.os.EOL + app.os.EOL;
			let titles = foundEntries.map(entry => entry.title);
			if (titles.length > MAX_ENTRIES_IN_RESPONSE) {
				titles.splice(MAX_ENTRIES_IN_RESPONSE);
				titles.push("...");
			}

			response += titles.join(app.os.EOL);
		} else if (foundEntries.length === 1) {
			const entry = app.libs._.first(foundEntries);

			response = [
				entry.title,
				entry.username && `Username: ${entry.username}`,
				entry.password && `Password: ${entry.password}`,
				entry.notes && `Notes: ${entry.password}`
			].filter(Boolean).join(app.os.EOL);
		} else {
			response = "Не найдено записей";
		}

		return response;
	}
};
