import {newSearch, newToolbar, Runnable, WaltzWidgetMixin} from "@waltz-controls/waltz-webix-extensions";
import {from} from "rxjs";
import {groupBy, mergeMap, reduce} from "rxjs/operators";
import {TangoId} from "@waltz-controls/tango-rest-client";
import {kWidgetXenvHq} from "./index";

/**
 * From Waltz actions
 *
 * @type {string}
 */
const kActionSelectTangoDevice = 'action:select_tango_device'

const findAll = () => true;

function newDataSourcesView(config) {
    return {
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
            }
        }
    ]
    }
}

function newXenvServersView(config) {
    return {
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
                    <span class="webix_strong">#name#</span>, State: | <span class="webix_strong" style="{common.stateHighlightColor()}">#state#</span> |<br>
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
                        config.root.dispatch(TangoId.fromDeviceId(id), kActionSelectTangoDevice);
                    }
                }
            },
            newToolbar()
        ]
    }
}


/**
 *
 * @author Igor Khokhriakov <igor.khokhriakov@hzg.de>
 * @since 4/9/19
 */
const main = webix.protoUI({
    name: "main",
    _ui(config) {
        return {
            cols: [
                newDataSourcesView(config),
                newXenvServersView(config)
            ]
        }
    },
    get servers(){
        return this.$$('listServers');
    },
    get collections() {
        return this.$$('listCollections');
    },
    resetDataSources(){
        this.collections.data.each(item => {
            item.markCheckbox = 0;
        });
        this.collections.refresh();
    },
    prepareCollections(){
        const result = {
            lvalue:[],
            svalue: []
        };

        this.collections.data.each(item => {
            result.svalue.push(item.id);
            result.lvalue.push(item.markCheckbox);
        });

        return result;
    },
    run() {
        this.getTangoRest().then(rest => rest.toTangoRestApiRequest()
            .attributes()
            .value()
            .get(`?${this.servers.find(findAll).map(server => ['wildcard=' + server.id + '/state', 'wildcard=' + server.id + '/status']).flat().join('&')}`)
            .pipe(
                mergeMap(resp => from(resp)),
                groupBy(update => update.device),
                mergeMap((group$) => group$.pipe(reduce((acc, cur) => Object.assign(acc, {
                    host: `${cur.host}`,
                    device: `${cur.device}`,
                    [cur.name.toLowerCase()]: cur.value
                }), {})))
            ).subscribe(update => {
                const server = this.servers.getItem(`${update.host}/${update.device}`);
                this.config.root.dispatch({
                    ...update,
                    data: update.status
                }, `${server.name}.Status`, `${kWidgetXenvHq}.subscription`);

                this.config.root.dispatch({
                    ...update,
                    data: update.state
                }, `${server.name}.State`, `${kWidgetXenvHq}.subscription`);
            })
        )
            .catch(e => {
                debugger
            })

    },
    $init(config) {
        webix.extend(config, this._ui(config));

        this.$ready.push(() => {


            this.collections.data.sync(config.root.collections);
            this.servers.data.sync(config.root.servers);
        });
    },
    defaults: {
        on: {
            onViewShow() {
                //TODO
                // if(this.config.configurationManager.device == null) return;
                // this.$$('listCollections').load(newTangoAttributeProxy(PlatformContext.rest, this.config.host, this.config.device, "datasourcecollections"))
            }
        }
    }
}, Runnable, WaltzWidgetMixin, webix.ProgressBar, webix.IdSpace, webix.ui.layout);

export function newXenvMainBody(config){
    return webix.extend({
        view: "main",
        id:"main_tab"
    },config);
}
