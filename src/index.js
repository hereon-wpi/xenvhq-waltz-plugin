import {ConfigurationManager, DataFormatServer, XenvServer} from "./xenv_models.js";
import {WaltzWidget} from "@waltz-controls/middleware";
import {kUserContext} from "@waltz-controls/waltz-user-context-plugin";
import {TangoId} from "@waltz-controls/tango-rest-client";
import {kContextTangoSubscriptions, kTangoRestContext} from "@waltz-controls/waltz-tango-rest-plugin";
import {newXenvHqBody, newXenvHqBottom, newXenvHqLeftPanel, newXenvHqSettings} from "./xenv_views";
import {concat} from "rxjs";

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

const kWidgetHeader = '<span class="webix_icon mdi mdi-cube-scan"></span> Xenv HQ';
const kWidgetRequiersServers = '<span class="webix_icon mdi mdi-chat-alert"></span> XenvHQ widget requires at least 3 servers to be defined: ' + kRequiredServers.map(serverName => `<div>${serverName}</div>`).join('');

export const kWidgetXenvHq = 'widget:xenvhq:root';
export const kXenvLeftPanel = kWidgetXenvHq + ':accordionitem';
export const kXenvHqPanelId = kXenvLeftPanel + ':body';
const kMainWindow = 'widget:main';
//from Waltz.LogController
const kChannelLog = 'channel:log';
const kTopicLog = 'topic:log';
const kTopicError = 'topic:error';

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

let $$body;

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


        const collectionsProxy = {
            $proxy: true,
            save: (view, params, dp) => {
                switch (params.operation) {
                    case "insert":
                        return ((params.data.value) ?
                            this.cloneCollection(params.id, params.data.value) :
                            this.selectCollection(params.id).then(resp => this.collections.updateItem(params.id, resp)))
                            .then(() => this.collections.updateItem(params.id, {value: params.id}));
                    case "delete":
                        return this.getTangoRest()
                            .then(rest => rest.newTangoDevice(TangoId.fromDeviceId(this.configurationManager.id))
                                .newCommand('deleteCollection')
                                .execute(params.id)
                                .toPromise())

                }
            },
            // updateFromResponse: true//TODO does this work?
        }
        this.collections = new webix.DataCollection({
            save: collectionsProxy
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

    get $$panel() {
        return $$(kXenvHqPanelId)
    }

    getTangoRest() {
        return this.app.getContext(kTangoRestContext);
    }

    get $$body() {
        return $$body;
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

    body() {
        return {
            isolate: true,
            rows: [
                newXenvHqBody({
                    root: this,
                    configurationManager: this.configurationManager,
                    dataFormatServer: this.data_format_server
                }),
                newXenvHqBottom({
                    root: this
                })
            ]
        }
    }

    leftPanel() {
        return newXenvHqLeftPanel({
            root: this
        });
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
            this.collections.load(
                newTangoAttributeProxy(this.getTangoRest(), TangoId.fromDeviceId(this.configurationManager.id).setName("dataSourceCollections")))

            //OK
            this.initializeLeftPanel();


            $$body = this.$$body || $$(this.view.addView(this.body()));
            $$body.show();

            $$body.$$('datasources').$$('list').bind(this.collections);
            // this.updateSubscriptions();
        } else {
            this.dispatch(kWidgetRequiersServers, kTopicLog, kChannelLog);
        }
    }

    initializeLeftPanel() {
        const panel = $$(kXenvLeftPanel) || $$(this.app.getWidget(kMainWindow).leftPanel.addView(this.leftPanel()));

        this.$$panel.$$('list').data.sync(this.collections);

        this.$$panel.$$('frmCollectionSettings').bind(this.$$panel.$$('list'));
    }

    async updateAndRestartAll() {
        if (!this.main) {
            this.dispatch("Can not perform action: main server has not been set!", kTopicLog, kChannelLog);
            return;
        }

        const collections = this.view.$$('main_tab').prepareCollections();

        const rest = await this.getTangoRest();

        const main = rest.newTangoDevice(TangoId.fromDeviceId(this.main.id));
        const updateProfileCollections = rest.newTangoDevice(TangoId.fromDeviceId(this.configuration.id)).newCommand("selectCollections");
        const stopAll = main.newCommand("stopAll");
        const clearAll = main.newCommand("clearAll");
        const updateAll = main.newCommand("updateAll");
        const startAll = main.newCommand("startAll");

        concat(
            updateProfileCollections.execute(collections),
            stopAll.execute(),
            clearAll.execute(),
            updateAll.execute(),
            startAll.execute()
        ).subscribe({
            next: () => {
                this.dispatch("Successfully updated and restarted Xenv!", kTopicLog, kChannelLog);
            },
            error: () => {
                this.dispatchError("Failed to updated and restarted Xenv!", kTopicError, kChannelLog);
            }
        });
    }

    /**
     *
     * @param {{id, value}} collection
     * @return {Promise<void>}
     */
    addCollection(collection) {
        this.collections.add(collection);
    }

    /**
     *
     * @param {string} collectionId
     * @return {Promise<void>}
     */
    async selectCollection(collectionId) {
        const rest = await this.getTangoRest();
        return rest.newTangoDevice(TangoId.fromDeviceId(this.configurationManager.id))
            .newAttribute("datasourcescollection")
            .write(collectionId)
            .toPromise();
    }


    deleteCollection(collection) {
        return new Promise(function (success, fail) {
            webix.modalbox({
                buttons: ["No", "Yes"],
                width: 500,
                text: `<span class='webix_icon fa-exclamation-circle'></span><p>This will delete data sources collection ${collection} and all associated data sources! Proceed?</p>`,
                callback: function (result) {
                    if (result === "1") success();
                }
            });
        }).then(() => {
            this.collections.remove(collection);
        });
    }

    cloneCollection(collection, source) {
        return this.getTangoRest()
            .then(rest => rest.newTangoDevice(TangoId.fromDeviceId(this.configurationManager.id))
                .newCommand('cloneCollection')
                .execute([collection, source])
                .toPromise())
    }
}


/**
 *
 * @param {Promise<TangoRestApi>} rest
 * @param {TangoId} attrId
 * @return {{$proxy: boolean, load(*, *): void}}
 */
export function newTangoAttributeProxy(rest, attrId) {
    return {
        $proxy: true,
        load(view, params) {
            view.clearAll();
            return rest.then(rest => rest.newTangoAttribute(attrId)
                .toTangoRestApiRequest()
                .value()
                .get('', {
                    headers: {
                        "Accept": "text/plain"
                    }
                })
                .subscribe(resp => view.parse(resp)));
        }
    };
}

