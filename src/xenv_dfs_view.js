import {newSearch, WaltzWidgetMixin} from "@waltz-controls/waltz-webix-extensions";
import {newXenvServerLog} from "./xenv_views.js";
import {TangoId} from "@waltz-controls/tango-rest-client";
import {from} from "rxjs";
import {mergeMap} from "rxjs/operators";
import {kAlertIcon, kChannelLog, kTopicLog} from "./index";

const DfsViewBodyHeader = {
    id: 'header',
    template: "<span class='webix_strong'>DataFormatServer</span>  [<span class='webix_icon fa-microchip'></span> #ver#] | #state#",
    maxHeight: 40
};

/**
 *
 * @author Igor Khokhriakov <igor.khokhriakov@hzg.de>
 * @since 3/27/19
 */
//TODO const DfsProxy

const kDfsData = [
    {id:"cwd", name:"Current dir", value: undefined},
    {id:"nxTemplate", name:"NeXus template", value: undefined},
    {id:"nxFile", name:"NeXus file", value: undefined}
];

const DfsViewBodyMain = {
    gravity: 3,
    cols:[
        {
            rows: [
                {
                    template: "NeXus file structure:",
                    type: "header"
                },
                newSearch("nxTemplate","#value#"),
                {
                    view: "tree",
                    label: "nxTemplate",
                    name: "nxTemplate",
                    id: "nxTemplate",
                    labelPosition: "top"
                }
            ]
        },
        {view:"resizer"},
        {
            rows:[
                {
                    template: "Attributes:",
                    type: "header"
                },
                {
                    view: "datatable",
                    id:"attributes",
                    header: false,
                    columns: [
                        {id: 'name'},
                        {id: 'value', fillspace: true}
                    ],
                    data: kDfsData
                }
            ]
        }
    ]
};

const kFindAll = () => true;

const dfs = webix.protoUI({
    name: "dfs",
    async update() {
        const rest = await this.getTangoRest();
        rest.newTangoAttribute(TangoId.fromDeviceId(this.config.configurationManager.id).setName('nexusFileWebixXml'))
            .read()
            .subscribe(resp => {
                this.$$('nxTemplate').clearAll();
                this.$$('nxTemplate').parse(resp.value, "xml");
            })


        const $$attributes = this.$$('attributes');
        const attrs = $$attributes.find(kFindAll);

        if (this.config.dataFormatServer) {

            this.$$('header').setValues(this.config.dataFormatServer);

            rest.newTangoDevice(TangoId.fromDeviceId(this.config.dataFormatServer.id))
                .toTangoRestApiRequest()
                .attributes()
                .value()
                .get(`?${attrs.map(attr => 'attr=' + attr.name).join('&')}`)
                .pipe(
                    mergeMap(resp => from(resp))
                ).subscribe(update => {
                debugger
            })
        } else {
            this.config.root.dispatch(`${kAlertIcon} DataFormatServer is not set!`, kTopicLog, kChannelLog);
        }

    },
    _ui(){
        return {
            padding: 15,
            rows: [
                DfsViewBodyHeader,
                DfsViewBodyMain,
                {view:"resizer"},
                newXenvServerLog()
            ]
        }
    },
    $init:function(config){
        webix.extend(config, this._ui());
    },
    defaults:{
        on:{
            "DataFormatServer.update.status subscribe"(event){
                this.$$('log').add(event, 0);
                this.$$('header').setValues({
                    status: event.data
                });
            },
            onViewShow() {
                this.update();
            }
        }
    }
}, WaltzWidgetMixin, webix.IdSpace, webix.ui.layout);

export function newDfsViewBody(config) {
    return webix.extend({
        view: "dfs"
    },config);
}

