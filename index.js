'use strict'

let BadGui
try {
    BadGui = require('../badGui')
} catch (e) {
}

class MuteParty {
    constructor(mod) {
        this.mod = mod
        this.settings = mod.settings

        try {
            this.gui = new BadGui(mod);
            this.guiEnabled = true
        } catch (e) {
            this.guiEnabled = false
        }

        this.partyMembers = []
        this.tempMuted = []

        this.warned = []

        mod.game.initialize("party")
        mod.game.party.on("list", (members) => { this.updateParty(members) })
        mod.game.party.on("leave", () => { this.onPartyLeave() })

        mod.hook("S_CHAT", 3, event => {
            // Don't filter messages that are not say, party, raid or notice
            if (event.channel in [0, 1, 21, 25, 32] == false)
                return event

            let senderId = event.gameId
            let member = this.mod.game.party.getMemberData(senderId)

            if (member == null)
                return event

            if (this.isMuted(member.serverId, member.playerId))
                return false

            return event
        })

        mod.command.add('mute', {
            $default: this.showGui
        }, this)

        mod.command.add('mute-internal', {
            temp(serverId, playerId) { this.temporarilyMute(serverId, playerId) },
            unmute(serverId, playerId) { this.unmute(serverId, playerId) },
            perm(serverId, playerId) { this.permanentlyMute(serverId, playerId) }
        }, this)
    }

    destructor() {
        this.mod.saveSettings()
    }

    updateParty(members) {
        this.partyMembers = members.filter(m => !this.mod.game.me.is(m.gameId))

        let newMembers = this.partyMembers.filter(m => this.warned.indexOf(m.gameId) == -1)
        let newMuted = newMembers.filter(m => this.isMuted(m.serverId, m.playerId))

        newMuted.forEach(muted => {
            this.mod.command.message(`Joining party with muted player: ${muted.name}`)
            this.warned.push(muted.gameId)
        })
    }

    onPartyLeave() {
        this.partyMembers = []
        this.tempMuted = []
        this.warned = []
    }

    isMuted(serverId, playerId) {
        return this.isTempMuted(serverId, playerId) || this.isPermMuted(serverId, playerId)
    }

    isTempMuted(serverId, playerId) {
        let value = `${serverId}:${playerId}`

        return this.tempMuted.indexOf(value) != -1
    }

    isPermMuted(serverId, playerId) {
        let value = `${serverId}:${playerId}`

        return value in this.mod.settings.muted
    }

    permanentlyMute(serverId, playerId) {
        let value = `${serverId}:${playerId}`
        this.settings.muted[value] = true
        this.tempMuted = this.tempMuted.filter(ele => ele != value)
    }

    temporarilyMute(serverId, playerId) {
        this.tempMuted.push(`${serverId}:${playerId}`)
    }

    unmute(serverId, playerId) {
        let value = `${serverId}:${playerId}`
        this.tempMuted = this.tempMuted.filter(ele => ele != value)
        delete this.settings.muted[value]
    }

    createListSection(guiData, title, members) {
        if (members.length > 0) {
            guiData.push({ text: `<font color="#4dd0e1" size="+22">${title}</font><br>` })
            guiData.push({ text: `<font color="#e3d6d9" size="+18">` })
            members.forEach(member => {
                guiData.push({ text: `${member.name} ` })
                let isMuted = this.isMuted(member.serverId, member.playerId)
                if (isMuted) {
                    guiData.push({ text: `<font color="#204ed3">[Unmute]</font>`, command: `mute-internal unmute ${member.serverId} ${member.playerId} | mute` })
                } else {
                    guiData.push({ text: `<font color="#204ed3">[Mute this run]</font>`, command: `mute-internal temp ${member.serverId} ${member.playerId} | mute` })
                    guiData.push({ text: `<font color="#204ed3">[Mute permanently]</font>`, command: `mute-internal perm ${member.serverId} ${member.playerId} | mute` })
                }
                guiData.push({ text: `<br></font>` })
            });
            guiData.push({ text: `<br>` })
        }
    }

    showGui() {
        if (this.guiEnabled == false) {
            this.mod.command.message("GUI disabled.")
            return
        }

        if (this.mod.game.party.inParty() == false) {
            this.mod.command.message("You're not currently in a party.")
            return
        }

        let guiData = []

        let unmuted = this.partyMembers.filter(m => !this.isMuted(m.serverId, m.playerId))
        let tempMuted = this.partyMembers.filter(m => this.isTempMuted(m.serverId, m.playerId))
        let permMuted = this.partyMembers.filter(m => this.isPermMuted(m.serverId, m.playerId))

        this.createListSection(guiData, "Party members:", unmuted)
        this.createListSection(guiData, "Muted members (this run only):", tempMuted)
        this.createListSection(guiData, "Muted members (permanently):", permMuted)

        this.gui.parse(guiData, "Party Mute Utils")
    }
}

module.exports = MuteParty