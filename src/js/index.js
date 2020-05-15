import {newXenvHqBody, xenvHqBottom, xenvHqSettings, xenvHqToolbar} from "./xenv_views.js"
import {ConfigurationManager, DataFormatServer, XenvServer} from "./xenv_models.js";

// if(MVC.env() === "test")
//     import("./xenv_test.js").then(module => bad_status = module.bad_status)

const kServers = ["HeadQuarter","ConfigurationManager","XenvManager","StatusServer2","DataFormatServer","CamelIntegration","PreExperimentDataCollector"];

const kServerFieldMap = {
    "HeadQuarter":"main",
    "ConfigurationManager":"configuration",
    "XenvManager":"manager",
    "StatusServer2":"status_server",
    "DataFormatServer":"data_format_server",
    "CamelIntegration":"camel",
    "PreExperimentDataCollector":"predator"
};


function newXenvSVGTab(){
    return {
        header: "<span class='webix_icon fa-map-o'></span> Xenv HQ SVG",
        borderless: true,
        body: TangoWebapp.ui.newSVGboard({id: 'hq-svg', svg:"Xenv.svg"})
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
         * @param {WidgetState} state
         */
    restoreState:async function(state){
        this.showProgress({
            type:"icon",
            icon:"refresh",
        });

        for(const server of kServers){
            if(state.data[server])
                await this.dropDevice(state.data[server]);
        }
            this.$$('main_tab').run();
        this.hideProgress();
    },
    _ui:function(){
        return {
            rows:[
                xenvHqToolbar,
                xenvHqSettings,
                newXenvHqBody({
                    master: this,
                    configurationManager: this.configuration,
                    dataFormatServer: this.data_format_server
                }),
                xenvHqBottom
            ]
        }
    },
    async updateAndRestartAll(){
        if(!this.main) {
            TangoWebappHelpers.error("Can not perform action: main server has not been set!");
            return;
        }

        const collections = this.$$('main_tab').prepareCollections();

        const updateProfileCollections = await this.configuration.device.fetchCommand("selectCollections");
        const stopAll = await this.main.device.fetchCommand("stopAll");
        const clearAll = await this.main.device.fetchCommand("clearAll");
        const updateAll = await this.main.device.fetchCommand("updateAll");
        const startAll = await this.main.device.fetchCommand("startAll");

        updateProfileCollections.execute(collections)
            .then(() => stopAll.execute())
            .then(() => clearAll.execute())
            .then(() => updateAll.execute())
            .then(() => startAll.execute());
    },
        /**
         *
         * @param device_class
         * @return {*|undefined}
         */
        getServerByDeviceClass(device_class) {
            return this.servers.find(server => server.name === device_class, true);
        },
        _init(config) {
            this.servers = new webix.DataCollection({
                data: [
                    new XenvServer("HeadQuarter", undefined, "UNKNOWN", "Proxy is not initialized", null),
                    new XenvServer("XenvManager", undefined, "UNKNOWN", "Proxy is not initialized", null),
                    new ConfigurationManager(),
                    new XenvServer("StatusServer2", undefined, "UNKNOWN", "Proxy is not initialized", null),
                    new XenvServer("CamelIntegration", undefined, "UNKNOWN", "Proxy is not initialized", null),
                    new XenvServer("PreExperimentDataCollector", undefined, "UNKNOWN", "Proxy is not initialized", null),
                    new DataFormatServer()
                ]
            });
        },
        addStateAndStatusListeners: function (server) {
            PlatformContext.subscription.subscribe({
                    host: server.device.host.id,
                    device: server.device.name,
                    attribute: "status",
                    type: "change"
                },
                function (event) {
                    this.servers.updateItem(server.id, {
                        status: event.data
                    });
                    OpenAjax.hub.publish(`${server.name}.update.status`, event);
                }.bind(this),
                function (error) {
                    console.error(error.data);
                }.bind(this));

            PlatformContext.subscription.subscribe({
                    host: server.device.host.id,
                    device: server.device.name,
                    attribute: "state",
                    type: "change"
                },
                function (event) {
                    this.servers.updateItem(server.id, {
                        state: event.data
                    });
                    OpenAjax.hub.publish(`${server.name}.update.state`, event);
                }.bind(this),
                function (error) {
                    console.error(error.data);
                }.bind(this));
        },
        /**
         *
         * @param {string} id
         */
    async dropDevice(id){
        let device = TangoDevice.find_one(id);
        if(device == null) {
            try {
                const parts = id.split('/');
                const tango_host = parts.shift();
                device = await PlatformContext.rest.fetchHost(tango_host)
                    .then(host => host.fetchDevice(parts.join('/')))
            } catch (e) {
                TangoWebappHelpers.error(`Failed to fetch device[id=${id}]`,e);
                return;
            }
        }

        const device_class = device.info.device_class;

        const server = this.getServerByDeviceClass(device_class);

        if(server === undefined) return;

        this.servers.updateItem(server.id, {
            status: `Proxy has been set to ${device.id}`,
            ver: device.name,
            device
        });

        OpenAjax.hub.publish(`${server.name}.set.proxy`,{server});

        this.addStateAndStatusListeners(server);

        //update settings
        this.$$([kServerFieldMap[device_class]]).setValue(device.id);

        //update state
        const state = Object.create(null);
        state[device_class] = device.id;
        this.state.updateState(state);
    },
    get main(){
        return this.servers.find(server => server.name === "HeadQuarter",true);
    },
    get configuration(){
        return this.servers.find(server => server.name === "ConfigurationManager",true);
    },
    get manager(){
        return this.servers.find(server => server.name === "XenvManager",true);
    },
    get status_server(){
        return this.servers.find(server => server.name === "StatusServer2",true);
    },
    get camel(){
        return this.servers.find(server => server.name === "CamelIntegration",true);
    },
    get predator(){
        return this.servers.find(server => server.name === "PreExperimentDataCollector",true);
    },
    get data_format_server(){
        return this.servers.find(server => server.name === "DataFormatServer",true);
    },
        /**
         * @constructor
         * @param config
         */
        $init:function(config){
            this._init(config);

            webix.extend(config, this._ui());

            this.$ready.push(()=> {
                this.$$('main_tab').servers.sync(this.servers);
            });

            this.addDrop(this.getNode(),{
                /**
                 * @function
                 */
                $drop:function(source, target){
                    var dnd = webix.DragControl.getContext();
                    if(dnd.from.config.view === 'devices_tree_tree'){
                        this.dropDevice(dnd.source[0]);
                    }

                    return false;
                }.bind(this)
            });
        }
}, TangoWebappPlatform.mixin.Stateful, TangoWebappPlatform.mixin.OpenAjaxListener,
    webix.ProgressBar, webix.DragControl, webix.IdSpace,
    webix.ui.layout);

export function newXenvHeadQuarterTab(){
    return {
        header: "<span class='webix_icon mdi mdi-cube-scan'></span> Xenv HQ",
        borderless: true,
        body:
        {
            id: 'hq',
            view: "xenv-hq"
        }
    };
}

