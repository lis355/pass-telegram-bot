import { EOL } from "node:os";

import _ from "lodash";
import { Telegraf, Markup, session, Scenes } from "telegraf";

import ApplicationComponent from "../app/ApplicationComponent.js";
import generatePassword from "../tools/generatePassword.js";
import generateUsernameAndPassword from "../tools/generateUsernameAndPassword.js";

const MESSAGE_LIFETIME_IN_MILLISECONDS = 30000;
const MAX_SEARCH_ENTRIES_PRINT_COUNT = 3;
const MAX_SEARCH_ENTRIES_BUTTONS_COUNT = 10;
const MAX_GROUPS_PRINT_COUNT = 10;
const PASSWORD_OPTIONS_COUNT = 3;

function authMiddleware(ctx, next) {
	return isMeMiddleware(ctx, next);
}

function isMeMiddleware(ctx, next) {
	if (ctx.chat.id !== Number(process.env.TELEGRAM_USER_ID)) throw new Error(`Bad user @${ctx.chat.username} (id=${ctx.chat.id})`);

	return next();
}

// function commandMiddleware(ctx, next) {
// 	const parts = ctx.message.text.split(" ");

// 	ctx.state.command = {
// 		name: parts[0].substring(1),
// 		arguments: parts.slice(1)
// 	};

// 	return next();
// }

function copyableText(str) {
	return `\`${str}\``;
}

function formatEntryForCopy(entry) {
	const title = `${entry.fields.get("Title")} (${entry.parentGroup.name})`;
	const username = entry.fields.get("UserName");
	const password = entry.fields.get("Password");
	const notes = entry.fields.get("Notes");

	const lines = [title];
	if (username) lines.push(copyableText(username));
	if (password) lines.push(copyableText(password.getText ? password.getText() : password));
	if (notes) lines.push(...notes.split(EOL).map(copyableText));

	return lines.join(EOL);
}

export default class TelegramBotManager extends ApplicationComponent {
	async initialize() {
		await super.initialize();

		this.bot = new Telegraf(process.env.TELEGRAM_TOKEN);

		this.bot
			.use(
				(ctx, next) => {
					// if (this.application.isDevelopment) console.log(_.omit(ctx, "telegram"));

					return next();
				},
				authMiddleware,
				session({
					defaultSession: () => ({})
				}),
				(ctx, next) => {
					_.defaults(ctx.session, { messageToDeleteIds: [] });

					return next();
				},
				this.#createStage().middleware()
			)
			.catch((error, ctx) => {
				console.error(`Error for ${ctx.updateType}, ${error.message}, ${error.stack}`);
			})
			.launch({ dropPendingUpdates: !this.application.isDevelopment });
	}

	#createStage() {
		function Row(...children) {
			return children;
		}

		function Button(caption, action) {
			return { text: caption, callback_data: action };
		}

		function InlineKeyboard(...children) {
			return {
				reply_markup: {
					inline_keyboard: children
				}
			};
		}

		const stage = new Scenes.Stage([
			new Scenes.BaseScene("main")
				.enter(async ctx => {
					await this.#deleteSessionMessages(ctx);
				})
				.command("start", async ctx => {
					await this.bot.telegram.sendMessage(ctx.chat.id, this.#getHelpString(), { parse_mode: "Markdown" });

					ctx.scene.enter("main");
				})
				.command("help", async ctx => {
					await this.bot.telegram.sendMessage(ctx.chat.id, this.#getHelpString(), { parse_mode: "Markdown" });

					ctx.scene.enter("main");
				})
				.command("stop", async ctx => {
					this.application.quit(1);
				})
				.command("refresh", async ctx => {
					await this.application.keePassDbManager.reloadDb();

					this.#autoDeleteContextMessage(ctx);
					await this.#sendMessageWithAutoDelete(ctx.message.chat.id, "DB reloaded");
				})
				.command("psw", async ctx => {
					const lines = [];

					for (let i = 0; i < 3; i++) {
						const { username, password } = generateUsernameAndPassword();

						lines.push(copyableText(username));
						lines.push(copyableText(password));
						lines.push("");
					}

					const message = lines.join(EOL);

					const telegramOptions = {
						parse_mode: "Markdown"
					};

					this.#autoDeleteContextMessage(ctx);
					await this.#sendMessageWithAutoDelete(ctx.message.chat.id, message, telegramOptions);
				})
				.command("add", async ctx => {
					this.#pushCurrentMessageIdToMessageToDeleteIds(ctx);

					ctx.scene.enter("addEntry");
				})
				.action(/.+/, async ctx => {
					const entry = this.application.keePassDbManager.searchEntryByUuid(ctx.match.input);
					if (entry) {
						const message = formatEntryForCopy(entry);

						const telegramOptions = {
							parse_mode: "Markdown"
						};

						await this.#sendMessageWithAutoDelete(ctx.callbackQuery.message.chat.id, message, telegramOptions);
					}
				})
				.on("message", async ctx => {
					let message = "";
					let telegramOptions = {};

					const searchEntriesResult = this.application.keePassDbManager.searchEntries(ctx.message.text);
					if (searchEntriesResult.entries.length === 0) {
						message = "Не найдено";
					} else if (searchEntriesResult.entries.length <= MAX_SEARCH_ENTRIES_PRINT_COUNT) {
						message = searchEntriesResult.entries
							.map(formatEntryForCopy)
							.join(EOL + EOL);

						telegramOptions = {
							parse_mode: "Markdown"
						};
					} else {
						message = `${ctx.message.text} [${searchEntriesResult.entries.length}]`;

						telegramOptions = Markup.inlineKeyboard(
							searchEntriesResult.entries
								.slice(0, MAX_SEARCH_ENTRIES_BUTTONS_COUNT)
								.map(entry => {
									const title = `${entry.fields.get("Title")} (${entry.parentGroup.name})`;

									return [
										Markup.button.callback(title, entry.uuid.valueOf())
									];
								})
						);
					}

					this.#autoDeleteContextMessage(ctx);
					await this.#sendMessageWithAutoDelete(ctx.message.chat.id, message, telegramOptions);
				}),
			new Scenes.BaseScene("addEntry")
				.enter(async ctx => {
					ctx.scene.enter("addEntry-selectTitle");
				}),
			new Scenes.BaseScene("addEntry-selectTitle")
				.enter(async ctx => {
					const message = await this.bot.telegram.sendMessage(
						ctx.chat.id,
						"Write entry title",
						InlineKeyboard(
							Row(
								Button("-- Back --", "back")
							)
						)
					);

					ctx.session.messageToDeleteIds.push(message["message_id"]);
				})
				.action("back", ctx => ctx.scene.enter("main"))
				.on("message", async ctx => {
					this.#pushCurrentMessageIdToMessageToDeleteIds(ctx);

					ctx.session.title = ctx.message.text;

					ctx.scene.enter("addEntry-selectGroup");
				}),
			new Scenes.BaseScene("addEntry-selectGroup")
				.enter(async ctx => {
					const message = await this.bot.telegram.sendMessage(
						ctx.chat.id,
						"Select or write group name",
						InlineKeyboard(
							...this.application.keePassDbManager.getAllGroups()
								.slice(0, MAX_GROUPS_PRINT_COUNT)
								.map(group =>
									Row(
										Button(group.name, `group_${group.name}`)
									)
								),
							Row(
								Button("-- Back --", "back")
							)
						)
					);

					ctx.session.messageToDeleteIds.push(message["message_id"]);
				})
				.action(/group_/, async ctx => {
					const groupName = ctx.match.input.split("_")[1];
					ctx.session.group = this.application.keePassDbManager.getGroupByName(groupName);

					ctx.scene.enter("addEntry-selectUser");
				})
				.action("back", ctx => ctx.scene.enter("main"))
				.on("message", async ctx => {
					this.#pushCurrentMessageIdToMessageToDeleteIds(ctx);

					const groupName = ctx.message.text;
					ctx.session.group = this.application.keePassDbManager.getGroupByName(groupName);

					if (!ctx.session.group) {
						const message = await this.bot.telegram.sendMessage(
							ctx.chat.id,
							"Group don't exists"
						);

						ctx.session.messageToDeleteIds.push(message["message_id"]);

						ctx.scene.enter("addEntry-selectGroup");
					} else {
						ctx.scene.enter("addEntry-selectUser");
					}
				}),

			new Scenes.BaseScene("addEntry-selectUser")
				.enter(async ctx => {
					const message = await this.bot.telegram.sendMessage(
						ctx.chat.id,
						"Select or write user name",
						InlineKeyboard(
							...process.env.KEEPASS_USERNAMES_FOR_NEW_ENTRY.split(",").map(s => s.trim()).filter(Boolean)
								.map(name =>
									Row(
										Button(name, `username_${name}`)
									)
								),
							Row(
								Button("-- Back --", "back")
							)
						)
					);

					ctx.session.messageToDeleteIds.push(message["message_id"]);
				})
				.action(/username_/, async ctx => {
					ctx.session.username = ctx.match.input.split("_")[1];

					ctx.scene.enter("addEntry-selectPassword");
				})
				.action("back", ctx => ctx.scene.enter("main"))
				.on("message", async ctx => {
					this.#pushCurrentMessageIdToMessageToDeleteIds(ctx);

					ctx.session.username = ctx.message.text;

					ctx.scene.enter("addEntry-selectPassword");
				}),
			new Scenes.BaseScene("addEntry-selectPassword")
				.enter(async ctx => {
					const message = await this.bot.telegram.sendMessage(
						ctx.chat.id,
						"Select or write password",
						InlineKeyboard(
							...new Array(PASSWORD_OPTIONS_COUNT).fill(0).map(generatePassword)
								.map(password =>
									Row(
										Button(password, `password_${password}`)
									)
								),
							Row(
								Button("-- Back --", "back")
							)
						)
					);

					ctx.session.messageToDeleteIds.push(message["message_id"]);
				})
				.action(/password_/, async ctx => {
					ctx.session.password = ctx.match.input.split("_")[1];

					await this.#createNewEntryWithSessionData(ctx);

					ctx.scene.enter("main");
				})
				.action("back", ctx => ctx.scene.enter("main"))
				.on("message", async ctx => {
					this.#pushCurrentMessageIdToMessageToDeleteIds(ctx);

					ctx.session.password = ctx.message.text;

					await this.#createNewEntryWithSessionData(ctx);

					ctx.scene.enter("main");
				})
		], {
			default: "main"
		});

		return stage;
	}

	#getHelpString() {
		return `KeePassDB credentials telegram bot v${this.application.version}

${copyableText("/start")} - start bot
${copyableText("/stop")} - stop bot
${copyableText("/refresh")} - reload DB
${copyableText("/add")} - add entry
${copyableText("/psw")} - generate username and passwords`;
	}

	async #createNewEntryWithSessionData(ctx) {
		const entry = await this.application.keePassDbManager.createEntry(ctx.session.group, ctx.session.title, ctx.session.username, ctx.session.password, "");
		await this.application.keePassDbManager.saveDb();

		await this.#sendMessageWithAutoDelete(ctx.chat.id, [
			"New entry added",
			"",
			formatEntryForCopy(entry)
		].join(EOL), { parse_mode: "Markdown" });
	}

	#pushMessageIdToMessageToDeleteIds(ctx, message) {
		ctx.session.messageToDeleteIds.push(message["message_id"]);
	}

	#pushCurrentMessageIdToMessageToDeleteIds(ctx) {
		this.#pushMessageIdToMessageToDeleteIds(ctx, ctx.message);
	}

	async #deleteSessionMessages(ctx) {
		if (ctx.session.messageToDeleteIds.length > 0) {
			for (const messageId of ctx.session.messageToDeleteIds) {
				try {
					await this.bot.telegram.deleteMessage(ctx.chat.id, messageId);
				} catch (error) {
				}
			}

			ctx.session.messageToDeleteIds = [];
		}
	}

	async #sendMessageWithAutoDelete(chatId, message, options) {
		const sendMessageResponse = await this.bot.telegram.sendMessage(chatId, message, options);

		await this.#autoDeleteChatMessage(chatId, sendMessageResponse["message_id"]);
	}

	#autoDeleteChatMessage(chatId, messageId) {
		setTimeout(async () => {
			await this.bot.telegram.deleteMessage(chatId, messageId);
		}, MESSAGE_LIFETIME_IN_MILLISECONDS);
	}

	#autoDeleteContextMessage(ctx) {
		this.#autoDeleteChatMessage(ctx.message.chat.id, ctx.message["message_id"]);
	}
}
