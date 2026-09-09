var LocalChannelRenamer = (function (modules, patcher, storage, React) {
    'use strict';

    // Persistent key-value storage for channel ID -> custom name
    storage.storage.customNames = storage.storage.customNames || {};
    var unpatches = [];
    var index = {
      onLoad: function onLoad() {
        var ChannelStore = modules.findByProps("getChannel", "getChannels");
        var ChannelActions = modules.findByProps("ChannelActionsSheet") || modules.findByName("ChannelActionsSheet", false);
        var ActionSheet = modules.findByProps("ActionSheetRow", "ActionSheetTitle");
        var Alerts = modules.findByProps("openAlert", "dismissAlert");
        var _ref = modules.findByProps("Alert") || {},
          Alert = _ref.Alert;

        // 1. Intercept getChannel so anywhere Discord reads the channel name, it gets your override
        if (ChannelStore) {
          var unpatchStore = patcher.after("getChannel", ChannelStore, function (args, channel) {
            if (!channel) return channel;
            var custom = storage.storage.customNames[channel.id];
            if (custom) {
              return new Proxy(channel, {
                get: function get(target, prop) {
                  if (prop === "name") return custom;
                  return target[prop];
                }
              });
            }
            return channel;
          });
          unpatches.push(unpatchStore);
        }

        // Helper function to prompt the user for input
        var promptUserForName = function promptUserForName(channel) {
          var current = storage.storage.customNames[channel.id] || "";

          // Try native React Native prompt first
          if (Alert && Alert.prompt) {
            Alert.prompt("Rename Channel Locally", "Enter a local alias for #".concat(channel.name, " (leave empty to reset):"), [{
              text: "Cancel",
              style: "cancel"
            }, {
              text: "Reset",
              style: "destructive",
              onPress: function onPress() {
                delete storage.storage.customNames[channel.id];
              }
            }, {
              text: "Save",
              onPress: function onPress(text) {
                if (text && text.trim().length > 0) {
                  storage.storage.customNames[channel.id] = text.trim();
                } else {
                  delete storage.storage.customNames[channel.id];
                }
              }
            }], "plain-text", current);
            return;
          }

          // Fallback: Discord internal Alert modal
          if (Alerts && Alerts.openAlert) {
            Alerts.openAlert({
              title: "Rename Channel Locally",
              content: "Clear the custom name or keep existing: ".concat(current || "None"),
              confirmText: "Clear Custom Name",
              cancelText: "Close",
              onConfirm: function onConfirm() {
                delete storage.storage.customNames[channel.id];
              }
            });
          }
        };

        // 2. Patch the bottom sheet action rows
        if (ChannelActions && ActionSheet && ActionSheet.ActionSheetRow) {
          var methodName = ChannelActions["default"] ? "default" : "ChannelActionsSheet";
          var unpatchSheet = patcher.after(methodName, ChannelActions, function (args, componentTree) {
            var _componentTree$props, _rootChildren$props;
            var props = args[0];
            var channel = (props === null || props === void 0 ? void 0 : props.channel) || ChannelStore && ChannelStore.getChannel(props === null || props === void 0 ? void 0 : props.channelId);
            if (!channel) return componentTree;

            // Create the row element to insert
            var customRow = /*#__PURE__*/React.createElement(ActionSheet.ActionSheetRow, {
              label: "Rename Locally",
              icon: "ic_edit_24px",
              onPress: function onPress() {
                return promptUserForName(channel);
              }
            });

            // Find the children container in the React tree and push our row
            var rootChildren = componentTree === null || componentTree === void 0 || (_componentTree$props = componentTree.props) === null || _componentTree$props === void 0 ? void 0 : _componentTree$props.children;
            if (Array.isArray(rootChildren)) {
              rootChildren.push(customRow);
            } else if (rootChildren !== null && rootChildren !== void 0 && (_rootChildren$props = rootChildren.props) !== null && _rootChildren$props !== void 0 && _rootChildren$props.children && Array.isArray(rootChildren.props.children)) {
              rootChildren.props.children.push(customRow);
            }
            return componentTree;
          });
          unpatches.push(unpatchSheet);
        }
      },
      onUnload: function onUnload() {
        // Clean up all patches when the plugin is turned off
        for (var _i = 0, _unpatches = unpatches; _i < _unpatches.length; _i++) {
          var unpatch = _unpatches[_i];
          if (typeof unpatch === "function") unpatch();
        }
        unpatches.length = 0;
      }
    };

    return index;

})(revenge.modules, revenge.patcher, revenge.storage, window.React || React);
