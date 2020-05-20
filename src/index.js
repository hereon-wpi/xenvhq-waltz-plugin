import {ConfigurationManager, DataFormatServer, XenvServer} from "./xenv_models.js";
import {WaltzWidget} from "@waltz-controls/middleware";
import {kUserContext} from "@waltz-controls/waltz-user-context-plugin";
import {TangoId} from "@waltz-controls/tango-rest-client";
import {kContextTangoSubscriptions, kTangoRestContext} from "@waltz-controls/waltz-tango-rest-plugin";
import {newXenvHqBody, newXenvHqBottom, newXenvHqSettings, newXenvHqToolbar} from "./xenv_views";
import {concat} from "rxjs";


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

export const kWidgetXenvHq = 'widget:xenvhq:root';
//from Waltz.LogController
const kChannelLog = 'channel:log';
const kTopicLog = 'topic:log';
const kTopicError = 'topic:error';

export class XenvHqWidget extends WaltzWidget {
    constructor(app) {
        super(kWidgetXenvHq, app);

        const proxy = {
            $proxy: true,
            load: () => {
                return this.app.getContext(kUserContext).then(userContext =>
                    userContext.getOrDefault(this.name, []).map(contextItem => new XenvServer(contextItem)))
            },
            save: (view, params, dp) => {
                return Promise.resolve(42);
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
                onAfterAdd() {
                    debugger
                }
            }
        });

        kServers.forEach(server => {
            this.listen(update => {
                debugger
            }, `${server}.State`, this.name)

            this.listen(update => {
                debugger
            }, `${server}.Status`, this.name)
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
        }), server.name, this.name)

        this.app.registerObservable(`${server.name}.Status`, subscriptions.observe({
            host: tangoId.getTangoHostId(),
            device: tangoId.getTangoDeviceName(),
            attribute: "Status",
            type: "change"
        }), server.name, this.name)
    }

    /**
     *
     * @param {XenvServer} server
     */
    unsubscribe(server) {
        this.app.unregisterObservable(`${server.name}.State`)

        this.app.unregisterObservable(`${server.name}.Status`)
    }

    async updateSubscriptions() {
        await this.servers.waitData;
        this.servers.data.each(server => this.subscribe(server))
    }

    /**
     *
     * @param {TangoId} id
     */
    async dropDevice(id) {
        const rest = await this.getTangoRest();
        const device = await rest.newTangoDevice(id).toTangoRestApiRequest().get().toPromise();
        debugger
        const device_class = device.info.device_class;

        const server = this.getServerByDeviceClass(device_class);

        if (server === undefined) return;

        this.servers.updateItem(server.id, {
            status: `Proxy has been set to ${device.id}`,
            ver: device.name,
            device
        });

        OpenAjax.hub.publish(`${server.name}.set.proxy`, {server});

        this.addStateAndStatusListeners(server);

        //update settings
        this.$$([kServerFieldMap[device_class]]).setValue(device.id);

        //update state
        const state = Object.create(null);
        state[device_class] = device.id;
        this.state.updateState(state);
    }

    getTangoRest() {
        return this.app.getContext(kTangoRestContext);
    }

    get main() {
        return this.servers.find(server => server.name === "HeadQuarter", true);
    }

    get configuration() {
        return this.servers.find(server => server.name === "ConfigurationManager", true);
    }

    get manager() {
        return this.servers.find(server => server.name === "XenvManager",true);
    }

    get status_server(){
        return this.servers.find(server => server.name === "StatusServer2",true);
    }

    get camel(){
        return this.servers.find(server => server.name === "CamelIntegration",true);
    }

    get predator(){
        return this.servers.find(server => server.name === "PreExperimentDataCollector",true);
    }

    get data_format_server(){
        return this.servers.find(server => server.name === "DataFormatServer",true);
    }

    ui(){
        return {
            header:kWidgetHeader,
            borderless: true,
            body: {
                id: this.name,
                isolate: true,
                rows: [
                    newXenvHqToolbar(),
                    newXenvHqSettings(),
                    newXenvHqBody({
                        root: this,
                        configurationManager: this.configuration,
                        dataFormatServer: this.data_format_server
                    }),
                    newXenvHqBottom({
                        root: this
                    })
                ]
            }
        }
    }

    run() {
        const tab = this.view || $$(this.app.getWidget('widget:main').mainView.addView(this.ui()));
        webix.extend(tab, webix.ProgressBar);
        tab.$$('settings').$$('list').sync(this.servers);

        this.updateSubscriptions();
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
}


export function newTangoAttributeProxy(rest, host, device, attr) {
    return {
        $proxy: true,
        load(view, params) {
            if(view.clearAll)
                view.clearAll();
            view.parse(rest.request().hosts(host).devices(device).attributes(attr).value().get()
                .then(value => JSON.parse(value.value))
                .catch(err => TangoWebappHelpers.error(err)));
        },
        save(view, params, dp) {
            //TODO
        },
        result() {

        }
    };
}

const xenvHq = webix.protoUI({
    name: "xenv-hq",
    profile: null,
    async applySettings(){
        for(const server of kServers){
            if(this.$$(kServerFieldMap[server]).getValue()) {
                await this.dropDevice(this.$$(kServerFieldMap[server]).getValue());
            }
        }
    },


        /**
         *
         * @param device_class
         * @return {*|undefined}
         */
        getServerByDeviceClass(device_class) {
            return this.servers.find(server => server.name === device_class, true);
        },

        /**
         * @constructor
         * @param config
         */
        $init:function(config){
            webix.extend(config, this._ui(config));

            this.$ready.push(()=> {
                this.$$('main_tab').servers.sync(this.servers);
            });

            this.addDrop(this.getNode(),{
                /**
                 * @function
                 */
                $drop:function(source, target){
                    const dnd = webix.DragControl.getContext();
                    if(dnd.from.config.view === 'devices_tree_tree'){
                        this.dropDevice(dnd.source[0]);
                    }

                    return false;
                }.bind(this)
            });
        }
}, webix.ProgressBar, webix.DragControl, webix.IdSpace,
    webix.ui.layout);

