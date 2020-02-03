import newSearch from "/waltz/resources/webix_widgets/search.js";
import newToolbar from "/waltz/resources/webix_widgets/attrs_monitor_toolbar.js";
import {newTangoAttributeProxy} from "./index.js";

const dataSourcesView = {
    padding: 15,
    rows: [
        {
            template: "Nexus file data source collections",
            type: "header"
        },
        newSearch("listDataSources", "#value#"),
        {
            view: "list",
            id: "listCollections",
            select:true,
            multiselect: true,
            template:
                "{common.markCheckbox()} #value#",
            gravity: 4,
            type: {
                height: "auto",
                markCheckbox(obj){
                    return "<span class='check webix_list_icon mdi mdi-"+(obj.markCheckbox?"check-box-outline":"checkbox-blank-outline")+"'></span>";
                }
            },
            onClick:{
                "check":function(e, id){
                    const item = this.getItem(id);
                    item.markCheckbox = item.markCheckbox?0:1;
                    this.updateItem(id, item);
                }
            },
            on: {
                /**
                 * tick checkboxes
                 */
                onAfterLoad(){
                    this.getTopParentView().config.configurationManager.getSelectedCollections().then(v => {
                            v
                                .map(item => {
                                    const {id, value} = item;
                                    return {id, markCheckbox: value}
                                })
                                .forEach(item => {
                                        this.updateItem(item.id, item)
                                    }
                                )
                        }
                    )
                }
            }
        }
    ]
};

const xenvServersView = {
    padding: 15,
    rows: [
        {
            template: "X-Environment Servers",
            type: "header"
        },
        {
            view: "list",
            id: "listServers",
            drag: "order",
            /**
             *
             * @param {XenvServer} obj
             */
            template:
                `<div style="margin: 2em">
                    <span class="webix_strong">#name#, device: #ver#</span><br>
					State:  | <span class="webix_strong" style="{common.stateHighlightColor()}">#state#</span> | <br/>
					Status: |  <span>#status#</span> |<br>
                    </div>`
            ,
            type: {
                height: "auto",
                stateHighlightColor: obj => {
                    switch (obj.state) {
                        case "ON":
                            return "background-color: #9ACD32";
                        case "RUNNING":
                            return "background-color: #6B8E23; color: white";
                        case "ALARM":
                            return "background-color: #FFFF00";
                        case "FAULT":
                            return "background-color: #B22222; color: white";
                        case "STANDBY":
                            return "background-color: #FFD700";
                        case "UNKNOWN":
                        default:
                            return "background-color: #D3D3D3";
                    }
                }
            },
            on: {
                onItemClick(id) {
                    const device = this.getItem(id).device;
                    PlatformContext.loadAndSetDevice(device.id);
                    
                    PlatformApi.PlatformUIController().expandDeviceTree();
                },
                onItemDblClick(id) {
                    //TODO open tab with configuration, log etc
                }
            }
        },
        newToolbar()
    ]
};

/**
 *
 * @author Igor Khokhriakov <igor.khokhriakov@hzg.de>
 * @since 4/9/19
 */
const main = webix.protoUI({
    name: "main",
    _ui(){
        return {
            cols:[
                dataSourcesView,
                xenvServersView
            ]
        }
    },
    get servers(){
        return this.$$('listServers');
    },
    get data(){
        return this.$$('listCollections');
    },
    resetDataSources(){
        this.$$('listCollections').data.each(item => {
            item.markCheckbox = 0;
        });
        this.$$('listCollections').refresh();
    },
    prepareCollections(){
        const result = {
            lvalue:[],
            svalue:[]
        };

        this.data.data.each(item => {
            result.svalue.push(item.id);
            result.lvalue.push(item.markCheckbox);
        });

        return result;
    },
    run:function(){
        this.servers.data.each(async server => {
            let state, status;
            [state, status]  = await webix.promise.all([
                server.fetchState(),
                server.fetchStatus()
            ]);
            this.servers.updateItem(server.id , {state, status});
        });
    },
    $init(config){
        webix.extend(config, this._ui());

        OpenAjax.hub.subscribe(`ConfigurationManager.set.proxy`,(eventName,{server})=>{
            webix.extend(this.config, {
                host: server.device.host.id.replace(':','/'),
                device: server.ver
            });

            this.$$('listCollections').load(newTangoAttributeProxy(PlatformContext.rest, this.config.host, this.config.device, "datasourcecollections"))
        });
    },
    defaults:{
        on:{
            onViewShow(){
                if(this.config.configurationManager.device == null) return;
                this.$$('listCollections').load(newTangoAttributeProxy(PlatformContext.rest, this.config.host, this.config.device, "datasourcecollections"))
            }
        }
    }
}, TangoWebappPlatform.mixin.Runnable, webix.ProgressBar, webix.IdSpace, webix.ui.layout);

export function newXenvMainBody(config){
    return webix.extend({
        view: "main",
        id:"main_tab"
    },config);
}
