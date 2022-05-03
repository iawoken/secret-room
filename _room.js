const { Client, Intents, Constants, MessageEmbed, MessageButton, MessageActionRow, MessageSelectMenu } = require("discord.js");
const { stripIndents } = require("common-tags");
const Schema = require("./_model.js");
const Modals = require("discord-modals");
const mongoose = require("mongoose");

class Bot extends Client {
    constructor(options = {}) {
        super({
            presence: { activities: [{ name: "awoken was here", type: "WATCHING" }] },
            partials: [
                ...Object.keys(Constants.PartialTypes)
            ],
            intents: [
                ...Object.keys(Intents.FLAGS)
            ],
            ...options
        });

        this.config = {
            TOKEN: "",
            MONGO: "",
            CATEGORY: "",
            LOG: ""
        }
    }

    getRandomInt (min, max) {
        min = Math.ceil(min);
        max = Math.floor(max);
        return Math.floor(Math.random() * (max - min + 1)) + min;
    }

    async init () {
        mongoose.connect(this.config.MONGO, { useNewUrlParser: true, useUnifiedTopology: true })
        .then(() => {
            this.login(this.config.TOKEN).then(async () => {
                console.log("Discord Bağlantısı Kuruldu ✔")
            })
            console.log("Mongo Bağlantısı Kuruldu ✔")
        });
    }
}

const App = new Bot();
App?.init()
Modals(App);

/**
 * @param {Client} App 
*/

App?.on("ready", async () => {
    const Guild = App?.guilds.cache.first();

    setInterval(async () => {
        const NonRooms = (await Schema.find({}) || [])?.filter((r) => !Guild.channels.cache.get(r.Id) || (Date.now() - (r.LastJoin ?? 0)) > (1000*60*30) && (Guild.channels.cache.get(r.Id)?.members?.size ?? 0) == 0);

        for (let VT of NonRooms) {
            await Schema.deleteMany({Id: VT.Id});
            if (Guild.channels.cache.get(VT.Id) && Guild.channels.cache.get(VT.Id)?.deletable) Guild.channels.cache.get(VT.Id)?.delete("Oda ile 30 dakika içerisinde herhangi bir etkileşimde bulunulmadı.");
        }
    }, 1000*30)
})

const Stats = mongoose.model("RoomDuration", new mongoose.Schema({
    User: String,
    Room: String,
    Duration: Number
}))

const Log = (content) => {
    const Guild = App?.guilds.cache.first();
    const Embed = new MessageEmbed()
    .setColor("RANDOM")
    .setAuthor({name: Guild?.name, iconURL: Guild?.iconURL({dynamic: true})})
    .setDescription(content)
    Guild?.channels.cache.get(App?.config.LOG)?.send({embeds: [Embed]});
}

App?.on("messageCreate", async (message) => {
    if (message.author.bot || !message.guild || !message.content.toLowerCase().startsWith(".")) return;
    
    let args = message.content.split(' ').slice(1);
    let command = message.content.split(' ')[0].slice(1);
    let embed = new MessageEmbed().setColor("RANDOM").setAuthor({name: message.member.displayName, iconURL: message.member.displayAvatarURL({dynamic: true})})

    switch (command) {
        case "menü":
        case "menu":
            const Room = await Schema.findOne({Owner: message.author.id})
            const Guild = App?.guilds.cache.first();

            const buttons = new MessageActionRow().addComponents([
                new MessageButton().setStyle('DANGER').setLabel(Room ? "🗑️ Odayı Sil" : "🗒️ Oda Oluştur").setCustomId(Room ? "delete" : "create"),
                new MessageButton().setStyle('DANGER').setLabel("✏️ Odayı Düzenle").setCustomId("edit").setDisabled(Room ? false : true),
                new MessageButton().setStyle('DANGER').setLabel("🔎 Görüntüle").setCustomId("view").setDisabled(Room ? false : true)
            ]);

            const tbuttons = new MessageActionRow().addComponents([
                new MessageButton().setStyle('SUCCESS').setLabel("💳 Kod Kullan").setCustomId("usetoken"),
                new MessageButton().setStyle('SUCCESS').setLabel("⚒️ Üyeleri Yönet").setCustomId("manageusers").setDisabled((Room?.Users?.length ?? 0) > 0 ? false : true),
                new MessageButton().setStyle('LINK').setLabel("Github").setURL("https://github.com/iawoken/secret-room")
            ]);

            message.channel.send({embeds: [embed.setDescription(stripIndents`
            Selam <@${message.author.id}> 👋

            Bu menü aracılığı ile kendine ait özel bir ses kanalı oluşturabilir veyahut da ses kanallarını düzenleyebilirsiniz.
            Her üyenin yalnız **1 adet** oda oluşturma hakkı bulunmaktadır ve bu hak **1 saat** gibi bir sürede yenilenir.

            Aşağıdaki interaktif butonlardan işleminizi gerçekleştirebilirsiniz, iyi eğlenceler!
            `)], components: [buttons, tbuttons]}).then(async (msg) => {
                const collector = msg.createMessageComponentCollector({
                    componentType: 'BUTTON',
                    filter: (component) => component.user.id === message.author.id,
                    time: 600000
                });

                collector.on("collect", async (c) => {
                    if (c.customId == "create") {
                        const createRoom = new Modals.Modal()
                        .setCustomId('createroom')
                        .setTitle('Oda oluştur')
                        .addComponents(
                            new Modals.TextInputComponent()
                            .setCustomId('name')
                            .setLabel('Oda ismi giriniz!')
                            .setStyle('SHORT')
                            .setMinLength(4)
                            .setMaxLength(20)
                            .setPlaceholder("Örn: awoken'in peynirleri")
                            .setRequired(true),
                            new Modals.TextInputComponent()
                            .setCustomId('password')
                            .setLabel('Oda şifresi giriniz!')
                            .setStyle('SHORT')
                            .setMinLength(4)
                            .setMaxLength(20)
                            .setPlaceholder("Örn: awokenveparaciklari")
                            .setRequired(true),
                            new Modals.TextInputComponent()
                            .setCustomId('limit')
                            .setLabel('Oda limiti giriniz!')
                            .setStyle('SHORT')
                            .setMinLength(1)
                            .setMaxLength(10)
                            .setPlaceholder("Örn: 0 (0: Sınırsız)")
                            .setRequired(true)
                        );

                        Modals.showModal(createRoom, {
                            client: App,
                            interaction: c
                        })

                        collector.stop()
                    } else if (c.customId == "delete") {
                        await Schema.deleteMany({Owner: message.author.id});
                        c.reply({embeds: [embed.setDescription(stripIndents`
                        Selam <@${message.author.id}> 👋

                        ✨ **${Room?.Name ?? "Bilinmeyen Oda"}** isimli oda başarılı bir şekilde silinmiştir.
                        `)]})
                        if (Guild.channels.cache.get(Room?.Id) && Guild.channels.cache.get(Room?.Id)?.deletable) Guild.channels.cache.get(Room?.Id)?.delete("Oda, oda sahibi tarafından silindi.");
                        Log(`🗑️ <@${message.author.id}> (\`${message.author.id}\`) tarafından **${Room?.Name ?? "Bilinmeyen Oda"}** isimli oda silindi.`)
                    } else if (c.customId == "usetoken") {
                        const enterPass = new Modals.Modal()
                        .setCustomId('usetoken')
                        .setTitle('Odaya erişim sağla')
                        .addComponents(
                            new Modals.TextInputComponent()
                            .setCustomId('password')
                            .setLabel('Oda şifresi giriniz!')
                            .setStyle('SHORT')
                            .setMinLength(4)
                            .setMaxLength(20)
                            .setPlaceholder("Elinizde bulunan şifreyi giriniz.")
                            .setRequired(true)
                        );

                        Modals.showModal(enterPass, {
                            client: App,
                            interaction: c
                        })

                        collector.stop()
                    } else if (c.customId == "edit") {
                        const myRoom = await Schema.findOne({Owner: message.author.id});

                        const editRoom = new Modals.Modal()
                        .setCustomId('edit')
                        .setTitle(`${myRoom?.Name} odasını düzenleyin`)
                        .addComponents(
                            new Modals.TextInputComponent()
                            .setCustomId('name')
                            .setLabel('Oda ismi giriniz!')
                            .setStyle('SHORT')
                            .setMinLength(4)
                            .setMaxLength(20)
                            .setDefaultValue(myRoom?.Name)
                            .setRequired(false),
                            new Modals.TextInputComponent()
                            .setCustomId('password')
                            .setLabel('Oda şifresi giriniz!')
                            .setStyle('SHORT')
                            .setMinLength(4)
                            .setMaxLength(20)
                            .setDefaultValue(myRoom?.Password)
                            .setRequired(false),
                            new Modals.TextInputComponent()
                            .setCustomId('limit')
                            .setLabel('Oda limiti giriniz!')
                            .setStyle('SHORT')
                            .setMinLength(1)
                            .setMaxLength(10)
                            .setPlaceholder(`Limit: ${myRoom?.MaxUser ?? 0}`)
                            .setRequired(false)
                        );

                        Modals.showModal(editRoom, {
                            client: App,
                            interaction: c
                        })

                        collector.stop()
                    } else if (c.customId == "view") {
                        const Room = await Schema.findOne({Owner: message.author.id});
                        const moment = require("moment");
                        require("moment-duration-format");
                        moment.locale("tr");

                        c.reply({content: stripIndents`
                        \`\`\`md\n# ${Room?.Name ?? "Bilinmeyen Oda"} isimli odanın bilgileri;

                        + Oda ismi: ${Room?.Name ?? "Bilinmeyen Oda"}
                        + Oda limiti: ${(Room?.Limit ?? "Sınırsız").replace(0, "Sınırsız")}
                        + Son giriş: ${moment((Room?.LastJoin ?? Date.now())).fromNow()}
                        + Odada geçirilen zaman: ${moment.duration(Room?.Duration ?? 0).format("h [saat], m [dakika], s [saniye]")} 

                        + Odaya erişimi olan kişiler (${(Room?.Users?.length ?? 0)+1})
                        ${Room?.Users?.concat(message.author.id)?.map((u) => `- ${Guild?.members.cache.get(u)?.user?.tag ?? `<@${u}>`}`).join("\n")}
                        \n\`\`\`
                        `})
                    } else if (c.customId == "manageusers") {
                        const myRoom = await Schema.findOne({Owner: message.author.id});
                        const Channel = Guild?.channels.cache.get(myRoom?.Id);

                        const members = myRoom.Users.map((x) => {
                            return {
                                label: message.guild.members.cache.get(x)?.user?.tag ?? x,
                                description: `Üyeyi kaldırmak için tıkla!`,
                                value: x
                            }
                        });

                        const row = new MessageActionRow().addComponents(
                            new MessageSelectMenu().setCustomId("members").setPlaceholder('Tıkla ve listele').addOptions([...members])
                        );

                        c.channel.send({content: `Odanızdan kaldırmak istediğiniz üyeleri aşağıdaki listeden seçiniz.`, components: [row]}).then(async (int) => {
                            const filter = i => {
                                i.deferUpdate();
                                return i.user.id === message.author.id;
                            };

                            int.awaitMessageComponent({ filter, componentType: 'SELECT_MENU', time: 60000 }).then((x) => {
                                x.values.map(async (v) => {
                                    await Schema.findOneAndUpdate({Owner: message.author.id}, {$pull: {Users: v}}, {upsert: true});
                                    await Channel?.permissionOverwrites.edit(v, {
                                        VIEW_CHANNEL: false,
                                        CONNECT: false
                                    })
                                })

                                msg.reply({content: `✅ Başarılı bir şekilde **${x.values?.length ?? 0}** adet üyenin odanıza erişim izni silindi!`})
                            });
                        });

                        collector.stop();
                    }
                });

                collector.on("end", (i) => {
                    buttons.components[0].setDisabled(true);
                    buttons.components[1].setDisabled(true);
                    buttons.components[2].setDisabled(true);
                    tbuttons.components[0].setDisabled(true);
                    tbuttons.components[1].setDisabled(true);
                    if (msg) msg.edit({components: [buttons, tbuttons]});
                });
            })
            break;
    
        default:
            break;
    }
})

App?.on("voiceStateUpdate", async (oldState, newState) => {
    if ((oldState.member && oldState.member.user.bot) || (newState.member && newState.member.user.bot)) return;
    if (!oldState.channelId && newState.channelId) {
        await Schema.findOneAndUpdate({Id: newState.channelId}, {$set: {LastJoin: Date.now()}}, {upsert: true});
        await Stats.findOneAndUpdate({User: newState.id}, {$set: {Duration: Date.now()}}, {upsert: true});
    }

    let Data = await Stats.findOne({User: newState.id});
    if (!Data) await Stats.findOneAndUpdate({User: newState.id}, {$set: {Duration: Date.now()}}, {upsert: true});
    Data = await Stats.findOne({User: newState.id});
    const duration = Date.now() - Data.Duration;

    const moment = require("moment");
    require("moment-duration-format");
    moment.locale("tr");

    if (oldState.channelId && !newState.channelId) {
        const Room = await Schema.findOne({Id: oldState.channelId});
        if (Room) await Schema.findOneAndUpdate({Id: oldState.channelId}, {$inc: {Duration: duration}}, {upsert: true});
        Log(`💡 <@${oldState.member.id}> (\`${oldState.member.id}\`) kişisi **${oldState.channel.name}** isimli odadan **ayrıldı.** Bu odada toplam \`${moment.duration(duration).format("h [saat], m [dakika], s [saniye]")}\` bulundu.`)
    } else if (oldState.channelId && newState.channelId) {
        const Room = await Schema.findOne({Id: oldState.channelId});
        if (Room) await Schema.findOneAndUpdate({Id: oldState.channelId}, {$inc: {Duration: duration}}, {upsert: true});
        Log(`💡 <@${oldState.member.id}> (\`${oldState.member.id}\`) kişisi **${newState.channel.name}** isimli odaya **giriş yaptı.** Bir önceki odada (\`${oldState.channel.name}\`) toplam \`${moment.duration(duration).format("h [saat], m [dakika], s [saniye]")}\` bulundu.`)
    };
})

App?.on("modalSubmit", async (modal) => {
    const Guild = App?.guilds.cache.first();

    if (modal.customId == "createroom") {
        const roomName = modal.getTextInputValue("name");
        const roomPass = modal.getTextInputValue("password");
        const roomLimit = modal.getTextInputValue("limit");

        Guild?.channels.create(roomName, {
            type: "GUILD_VOICE",
            userLimit: roomLimit > 99 ? 99 : roomLimit
        }).then(async (c) => {
            new Schema({
                Id: c.id,
                Owner: modal.user.id,
                Name: roomName,
                Password: roomPass,
                Users: [],
                Duration: 0,
                LastJoin: Date.now(),
                MaxUser: roomLimit > 99 ? 99 : roomLimit
            }).save()

            c.setParent(App?.config.CATEGORY);
            c.permissionOverwrites.edit(Guild?.id, {
                VIEW_CHANNEL: false,
                CONNECT: false
            });

            let embed = new MessageEmbed().setColor("RANDOM").setAuthor({name: modal.member.displayName, iconURL: modal.member.displayAvatarURL({dynamic: true})});
            const invite = await c.createInvite({maxUses: 1});
            
            if (!modal.replied) modal.reply({embeds: [embed.setDescription(stripIndents`
            Selam <@${modal.user.id}> 👋

            Odanız başarılı bir şekilde oluşturuldu. Odanıza [buraya tıklayarak](https://discord.gg/${invite.code}) ulaşabilirsiniz.
            `)]});

            Log(`🗒️ <@${modal.user.id}> (\`${modal.user.id}\`) tarafından **${roomName}** isimli oda oluşturuldu.`)
        })
    } else if (modal.customId == "usetoken") {
        const key = modal.getTextInputValue("password");
        const findRoom = await Schema.findOne({Password: key});

        let embed = new MessageEmbed().setColor("RANDOM").setAuthor({name: modal.member.displayName, iconURL: modal.member.displayAvatarURL({dynamic: true})});
        if (!findRoom) return modal.reply({embeds: [embed.setDescription(stripIndents`
        Selam <@${modal.user.id}> 👋

        ❌ Girmiş olduğunuz kod ile uyuşan herhangi bir oda veri tabanında bulunamadı.
        `)]})

        if (findRoom?.Users.includes(modal.user.id) || findRoom?.Owner == modal.user.id) return modal.reply({embeds: [embed.setDescription(stripIndents`
        Selam <@${modal.user.id}> 👋

        ❌ **${findRoom.Name ?? "Bilinmeyen Oda"}** isimli odaya zaten erişiminiz bulunmaktadır.
        `)]})

        if (Guild?.channels.cache.get(findRoom.Id)?.editable) Guild?.channels.cache.get(findRoom.Id)?.permissionOverwrites?.edit(modal.user.id, {
            VIEW_CHANNEL: true,
            CONNECT: true
        })
        await Schema.findOneAndUpdate({Password: key}, {$push: {Users: modal.user.id}}, {upsert: true});

       return modal.reply({embeds: [embed.setDescription(stripIndents`
        Selam <@${modal.user.id}> 👋

        🚀 **${findRoom.Name ?? "Bilinmeyen Oda"}** isimli odaya artık giriş yapabilirsiniz! Güzel ve hoş sohbetler...
        `)]})
    } else if (modal.customId == "edit") {
        const room = await Schema.findOne({Owner: modal.user.id});
        const name = modal.getTextInputValue("name");
        const password = modal.getTextInputValue("password");
        const limit = modal.getTextInputValue("limit");

        let embed = new MessageEmbed().setColor("RANDOM").setAuthor({name: modal.member.displayName, iconURL: modal.member.displayAvatarURL({dynamic: true})});
        modal.reply({embeds: [embed.setDescription(stripIndents`
        Selam <@${modal.user.id}> 👋

        🔎 Odanız başarılı bir şekilde güncellendi!
        `)]})
        
        if (Guild?.channels?.cache.get(room?.Id) && Guild?.channels?.cache.get(room?.Id)?.editable) {
            if (name !== (room?.Name)){
                await Schema.findOneAndUpdate({Owner: modal.user.id}, {$set:{Name: name}}, {upsert: true});
                await Guild?.channels?.cache.get(room?.Id)?.setName(name, "Oda sahibi, oda ismini değiştirdi.");
            } else if (limit !== (room?.Limit)){
                await Schema.findOneAndUpdate({Owner: modal.user.id}, {$set:{Limit: limit}}, {upsert: true});
                await Guild?.channels?.cache.get(room?.Id)?.setUserLimit(limit, "Oda sahibi, oda limitini değiştirdi.");
            } if (password !== (room?.Password)) await Schema.findOneAndUpdate({Owner: modal.user.id}, {$set:{Password: password}}, {upsert: true});
        }

        Log(`✏️ <@${modal.user.id}> (\`${modal.user.id}\`) tarafından **${name}** isimli oda güncellendi.`) 
    }
})