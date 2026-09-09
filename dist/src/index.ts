import { findByProps, findByName } from "@revenge-mod/modules";
import { after } from "@revenge-mod/patcher";
import { storage } from "@revenge-mod/storage";
import React from "react";

// Persistent key-value storage for channel ID -> custom name
storage.customNames = storage.customNames || {};

const unpatches: (() => void)[] = [];

export default {
    onLoad: () => {
        const ChannelStore = findByProps("getChannel", "getChannels");
        const ChannelActions = findByProps("ChannelActionsSheet") || findByName("ChannelActionsSheet", false);
        const ActionSheet = findByProps("ActionSheetRow", "ActionSheetTitle");
        const Alerts = findByProps("openAlert", "dismissAlert");
        const { Alert } = findByProps("Alert") || {};

        // 1. Intercept channel names
        if (ChannelStore) {
            const unpatchStore = after("getChannel", ChannelStore, (args: any, channel: any) => {
                if (!channel) return channel;

                const custom = storage.customNames[channel.id];
                if (custom) {
                    return new Proxy(channel, {
                        get(target, prop) {
                            if (prop === "name") return custom;
                            return target[prop];
                        }
                    });
                }
                return channel;
            });
            unpatches.push(unpatchStore);
        }

        // 2. Helper to prompt user
        const promptUserForName = (channel: any) => {
            const current = storage.customNames[channel.id] || "";

            if (Alert && Alert.prompt) {
                Alert.prompt(
                    "Rename Channel Locally",
                    `Enter a local alias for #${channel.name}:`,
                    [
                        { text: "Cancel", style: "cancel" },
                        { text: "Reset", style: "destructive", onPress: () => { delete storage.customNames[channel.id]; } },
                        { text: "Save", onPress: (text: string) => { if (text && text.trim().length > 0) { storage.customNames[channel.id] = text.trim(); } else { delete storage.customNames[channel.id]; } } }
                    ],
                    "plain-text",
                    current
                );
                return;
            }

            if (Alerts && Alerts.openAlert) {
                Alerts.openAlert({
                    title: "Rename Channel",
                    content: `Clear the custom name or keep existing: ${current || "None"}`,
                    confirmText: "Clear Custom Name",
                    cancelText: "Close",
                    onConfirm: () => { delete storage.customNames[channel.id]; }
                });
            }
        };

        // 3. Inject into bottom sheet
        if (ChannelActions && ActionSheet && ActionSheet.ActionSheetRow) {
            const methodName = ChannelActions.default ? "default" : "ChannelActionsSheet";

            const unpatchSheet = after(methodName, ChannelActions, (args: any, componentTree: any) => {
                const props = args[0];
                const channel = props?.channel || (ChannelStore && ChannelStore.getChannel(props?.channelId));
                if (!channel) return componentTree;

                const customRow = React.createElement(ActionSheet.ActionSheetRow, {
                    label: "Rename Locally",
                    icon: "ic_edit_24px",
                    onPress: () => promptUserForName(channel)
                });

                const rootChildren = componentTree?.props?.children;
                if (Array.isArray(rootChildren)) {
                    rootChildren.push(customRow);
                } else if (rootChildren?.props?.children && Array.isArray(rootChildren.props.children)) {
                    rootChildren.props.children.push(customRow);
                }

                return componentTree;
            });

            unpatches.push(unpatchSheet);
        }
    },

    onUnload: () => {
        for (const unpatch of unpatches) {
            if (typeof unpatch === "function") unpatch();
        }
        unpatches.length = 0;
    }
};
