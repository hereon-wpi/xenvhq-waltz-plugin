import {codemirror_textarea} from "@waltz-controls/waltz-webix-extensions";
import 'codemirror/mode/xml/xml.js';

import {newXenvMainBody} from "./xenv_hq_main_view.js";
import {newDataSourcesBody} from "./xenv_datasources_view.js";
import {newStatusServerViewBody} from "./xenv_status_server_view.js";
import {newCamelIntegrationViewBody} from "./xenv_camel_view.js";
import {newPredatorViewBody} from "./xenv_predator_view.js";
import {newDfsViewBody} from "./xenv_dfs_view.js";

const xml = webix.protoUI({
    name: "xml",
    update(value){
        if (!value || !this.editor) return;
        this.setValue(value);
    }
},codemirror_textarea);

export function newXmlView(){
    return {
        gravity: 2,
        rows: [
            {
                view: "xml",
                id: "xml",
                mode: "application/xml",
                matchClosing: true
            }
        ]
    }
}

export function newXenvServerLog() {
    return {
        view:"list",
        id:'log',
        type:{
            height: "auto",
            template(obj){
                return `<div>
                            <p>${obj.data}</p>
                            <div><span class="webix_icon fa-clock-o"></span>${obj.timestamp} [${new Date(obj.timestamp)}]</div>
                        </div>`;
            }
        }
    }
}

export function newXenvHqToolbar() {
    return {
        view: "toolbar",
        maxHeight: 30,
        cols: [
            {},
            {
                view: "icon",
                icon: "mdi mdi-settings",
                maxWidth: 30,
                click: function () {
                    const $$HQsettings = this.getTopParentView().$$("settings");
                    if ($$HQsettings.isVisible())
                        $$HQsettings.hide();
                    else
                        $$HQsettings.show();
                }
            }
        ]
    }
}

export function newXenvHqSettings() {
    return {
        id: 'settings',
        hidden: true,
        isolate: true,
        rows: [
            {
                view: 'list',
                id: 'list',
                template: '<b>#name#</b>:#id#',
                autoheight: true
            },
            {
                cols: [
                    {},
                    {
                        view: "button",
                        value: "Apply",
                        maxWidth: 120,
                        click() {
                            this.getTopParentView().applySettings();
                        }
                    }
                ]
            }
        ]
    }
}

export function newXenvHqBody(config){
    return {
        view: "tabview",
        cells: [
            {
                header: "Main",
                body: newXenvMainBody(config)
            },
            {
                header: "DataSources",
                body: newDataSourcesBody(config)
            },
            {
                header: "DataFormatServer",
                body: newDfsViewBody(config)
            },
            {
                header: "StatusServer",
                body: newStatusServerViewBody(config)
            },
            {
                header: "CamelIntegration",
                body: newCamelIntegrationViewBody(config)
            },
            {
                header: "PreExperimentDataCollector",
                body: newPredatorViewBody(config)
            }
        ]
    };
}

export function newXenvHqBottom(config) {
    return {
        view: "button",
        value: "Update & Restart all",
        minHeight: 80,
        click() {
            config.root.updateAndRestartAll()
        }
    }
}