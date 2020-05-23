import {ConfigurationManager, DataFormatServer, XenvServer} from "./xenv_models.js";
import {WaltzWidget} from "@waltz-controls/middleware";
import {kUserContext} from "@waltz-controls/waltz-user-context-plugin";
import {TangoId} from "@waltz-controls/tango-rest-client";
import {kContextTangoSubscriptions, kTangoRestContext} from "@waltz-controls/waltz-tango-rest-plugin";
import {newXenvHqSettings} from "xenv_views";
import XenvHqMainWidget from "widgets/main";

const kRequiredServers = ["HeadQuarter", "ConfigurationManager", "XenvManager"];
const kServers = ["HeadQuarter", "ConfigurationManager", "XenvManager", "StatusServer2", "DataFormatServer", "CamelIntegration", "PreExperimentDataCollector"];

const kServerFieldMap = {
    "HeadQuarter": "main",
    "ConfigurationManager": "configuration",
    "XenvManager": "manager",
    "StatusServer2": "status_server",
    "DataFormatServer": "data_format_server",
    "CamelIntegration": "camel",
    "PreExperimentDataCollector": "predator"
};

export const kAlertIcon = '<span class="webix_icon mdi mdi-chat-alert"></span>';
const kWidgetHeader = '<span class="webix_icon mdi mdi-cube-scan"></span> Xenv HQ';
const kWidgetRequiersServers = `${kAlertIcon} XenvHQ widget requires at least 3 servers to be defined: 
${kRequiredServers.map(serverName => `<div>${serverName}</div>`).join('')}`;

export const kWidgetXenvHq = 'widget:xenvhq:root';
export const kXenvLeftPanel = kWidgetXenvHq + ':accordionitem';
export const kXenvHqPanelId = kXenvLeftPanel + ':body';
export const kMainWindow = 'widget:main';
//from Waltz.LogController
export const kChannelLog = 'channel:log';
export const kTopicLog = 'topic:log';
export const kTopicError = 'topic:error';

const kFirstFound = true;

function devicesTreeIdToTangoId(tree, id) {
    const item = tree.getItem(id);
    const host = tree.getTangoHostId(item);

    return TangoId.fromDeviceId(`${host}/${item.device_name}`)
}

/**
 * As TangoDb may return device.classname === 'unknown' we have to use this work-around
 *
 * @example
 * development/xenv/hq -> HeadQuarter
 * development/xenv/config -> ConfigurationManager
 * development/xenv/manager -> XenvManager
 *
 * @param device
 * @return {string}
 */
function guessDeviceClass(device) {
    const name = device.split('/')[2];
    switch (name) {
        case "hq":
            return "HeadQuarter";
        case "config":
            return "ConfigurationManager";
        case "manager":
            return "XenvManager";
        default:
            throw new Error(`Can not guess device class for device ${device}. TangoDb returns classname === 'unknown'`);

    }

}

function getDeviceClass(info) {
    return info.classname !== 'unknown' ? info.classname : guessDeviceClass(info.name);
}


class ContextEntity {
    constructor({id, name}) {
        this.id = id;
        this.name = name;
    }
}

/**
 * @event CamelIntegration.Status
 * @description topic:CamelIntegration.Status channel:kWidgetXenvHq
 */
/**
 * @emits CamelIntegration.Status
 */
export class XenvHqWidget extends WaltzWidget {
    constructor(app) {
        super(kWidgetXenvHq, app);

        const proxy = {
            $proxy: true,
            load: () => {
                return this.getUserContext().then(userContext =>
                    userContext.getOrDefault(this.name, []).map(contextEntity => new XenvServer(contextEntity)))
            },
            save: (view, params, dp) => {
                switch (params.operation) {
                    case "insert":
                    case "update":
                        return this.getUserContext()
                            .then(userContext =>
                                userContext.updateExt(this.name, ext => {
                                    const newContextEntity = new ContextEntity(params.data);
                                    const index = ext.findIndex(contextEntity => contextEntity.name === params.data.name);
                                    if (index > -1) {
                                        ext[index] = newContextEntity;
                                    } else {
                                        ext.push(newContextEntity);
                                    }
                                }))
                            .then(userContext => userContext.save())
                            .then(() => this.dispatch(`UserContext for ${this.name} has been successfully updated!`, kTopicLog, kChannelLog));
                    default:
                        return Promise.resolve();
                }
            }
        }


        this.servers = new webix.DataCollection({
            // data: [
            //     new XenvServer("HeadQuarter", undefined, "UNKNOWN", "Proxy is not initialized", null),
            //     new XenvServer("XenvManager", undefined, "UNKNOWN", "Proxy is not initialized", null),
            //     new ConfigurationManager(),
            //     new XenvServer("StatusServer2", undefined, "UNKNOWN", "Proxy is not initialized", null),
            //     new XenvServer("CamelIntegration", undefined, "UNKNOWN", "Proxy is not initialized", null),
            //     new XenvServer("PreExperimentDataCollector", undefined, "UNKNOWN", "Proxy is not initialized", null),
            //     new DataFormatServer()
            // ]
            url: proxy,
            save: proxy,
            on: {
                onAfterLoad: () => {
                    this.servers.data.each(server => {
                        this.$$settings.$$([kServerFieldMap[server.name]]).setValue(server.id);
                    })
                },
                onDataUpdate: (id, server) => {
                    this.dispatch({
                        ...TangoId.fromDeviceId(server.id),
                        name: 'status',
                        value: server.status
                    }, `${server.name}.Status`, this.name);
                }
            }
        });




        kServers.forEach(server => {
            this.listen(update => {
                //TODO error
                //TODO update item
                debugger
            }, `${server}.State`, `${this.name}.subscription`)

            this.listen(update => {
                //TODO error
                //TODO update item
                debugger
            }, `${server}.Status`, `${this.name}.subscription`)
        })
    }

    get view() {
        return $$(this.name);
    }

    /**
     *
     * @param {XenvServer} server
     */
    async subscribe(server) {
        const subscriptions = await this.app.getContext(kContextTangoSubscriptions);

        const tangoId = TangoId.fromDeviceId(server.id);

        this.app.registerObservable(`${server.name}.State`, subscriptions.observe({
            host: tangoId.getTangoHostId(),
            device: tangoId.getTangoDeviceName(),
            attribute: "State",
            type: "change"
        }), `${server.name}.State`, `${this.name}.subscription`)

        this.app.registerObservable(`${server.name}.Status`, subscriptions.observe({
            host: tangoId.getTangoHostId(),
            device: tangoId.getTangoDeviceName(),
            attribute: "Status",
            type: "change"
        }), `${server.name}.Status`, `${this.name}.subscription`)
    }

    /**
     *
     * @param {XenvServer} server
     */
    unsubscribe(server) {
        this.app.unregisterObservable(`${server.name}.State`)

        this.app.unregisterObservable(`${server.name}.Status`)
    }

    updateSubscriptions() {
        this.servers.data.each(server => this.subscribe(server))
    }

    get $$settings() {
        return this.view.$$('settings');
    }

    getTangoRest() {
        return this.app.getContext(kTangoRestContext);
    }

    get main() {
        return this.servers.find(server => server.name === "HeadQuarter", true);
    }

    get configurationManager() {
        return this.servers.find(server => server.name === "ConfigurationManager", true);
    }

    get manager() {
        return this.servers.find(server => server.name === "XenvManager", true);
    }

    get status_server() {
        return this.servers.find(server => server.name === "StatusServer2", true);
    }

    get camel() {
        return this.servers.find(server => server.name === "CamelIntegration", true);
    }

    get predator() {
        return this.servers.find(server => server.name === "PreExperimentDataCollector", true);
    }

    get data_format_server() {
        return this.servers.find(server => server.name === "DataFormatServer", true);
    }

    /**
     *
     * @param {TangoId} id
     */
    async dropDevice(id) {
        const rest = await this.getTangoRest();
        const device = await rest.newTangoDevice(id).toTangoRestApiRequest().get().toPromise();
        const device_class = getDeviceClass(device.info);

        const server = this.servers.find(server => server.name === device_class, kFirstFound);

        if (server) {
            this.servers.data.changeId(server.id, device.id)
            this.servers.updateItem(device.id, {
                status: `Proxy has been set to ${device.id}`,
            });
        } else {
            this.servers.add(new XenvServer({
                id: device.id,
                name: device_class,
                status: `Proxy has been set to ${device.id}`,
                state: 'UNKNOWN'
            }))
        }
        //update settings
        this.$$settings.$$([kServerFieldMap[device_class]]).setValue(device.id);
    }

    getUserContext() {
        return this.app.getContext(kUserContext);
    }

    ui() {
        return {
            header: kWidgetHeader,
            borderless: true,
            body: {
                id: this.name,
                isolate: true,
                view: 'multiview',
                cells: [
                    newXenvHqSettings({
                        root: this
                    })
                ]
            }
        }
    }



    async run() {
        const tab = this.view || $$(this.app.getWidget(kMainWindow).mainView.addView(this.ui()));
        webix.extend(tab, webix.ProgressBar);
        webix.DragControl.addDrop(this.$$settings.getNode(), {
            $drop: () => {
                const context = webix.DragControl.getContext();
                if (context.from.config.view === 'devices_tree' &&
                    (context.from.getItem(context.source[0]).isAlias || context.from.getItem(context.source[0]).isMember)) {
                    this.dropDevice(devicesTreeIdToTangoId(context.from, context.source[0]));
                }
            }
        })
        tab.showProgress();


        await this.servers.waitData;


        tab.hideProgress();
        const requiredServers = this.servers.find(server => kRequiredServers.includes(server.name))
        if (requiredServers.length === kRequiredServers.length) {

            new XenvHqMainWidget(this.app).run();


            // this.updateSubscriptions();
        } else {
            this.dispatch(kWidgetRequiersServers, kTopicLog, kChannelLog);
        }
    }
}


