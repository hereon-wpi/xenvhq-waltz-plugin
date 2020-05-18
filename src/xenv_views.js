import {newXenvMainBody} from "./xenv_hq_main_view.js";
import {newDataSourcesBody} from "./xenv_datasources_view.js";
import {newStatusServerViewBody} from "./xenv_status_server_view.js";
import {newCamelIntegrationViewBody} from "./xenv_camel_view.js";
import {newPredatorViewBody} from "./xenv_predator_view.js";
import {newDfsViewBody} from "./xenv_dfs_view.js";
import {codemirror_textarea} from "@waltz-controls/waltz-webix-extensions";

const xml = webix.protoUI({
    name: "xml",
    update(value){
        if(!value) return;
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

export const xenvHqToolbar = {
    view: "toolbar",
    maxHeight: 30,
    cols: [
        {},
        {
            view: "icon",
            icon: "mdi mdi-settings",
            maxWidth: 30,
            click: function () {
                const $$HQsettings = this.getTopParentView().$$("hq-settings");
                if ($$HQsettings.isVisible())
                    $$HQsettings.hide();
                else
                    $$HQsettings.show();
            }
        }
    ]
};

export const xenvHqSettings = {
    id: 'hq-settings',
    hidden: true,
    rows: [
        {
            id: "main",
            view: "text",
            value: "",
            label: "HQ main",
            labelWidth: 120,
            tooltip: "HQ main",
            labelAlign: "right"
        },
        {
            id: "configuration",
            view: "text",
            value: "",
            label: "HQ configuration manager",
            labelWidth: 120,
            tooltip: "HQ configuration manager",
            labelAlign: "right"
        },
        {
            id: "manager",
            view: "text",
            value: "",
            label: "HQ xenv servers manager",
            labelWidth: 120,
            tooltip: "HQ xenv servers manager",
            labelAlign: "right"
        },
        {
            id: "camel",
            view: "text",
            value: "",
            label: "CamelIntegration",
            labelWidth: 120,
            tooltip: "CamelIntegration",
            labelAlign: "right"
        },
        {
            id: "status_server",
            view: "text",
            value: "",
            label: "StatusServer",
            labelWidth: 120,
            tooltip: "StatusServer",
            labelAlign: "right"
        },
        {
            id: "data_format_server",
            view: "text",
            value: "",
            label: "DataFormatServer",
            labelWidth: 120,
            tooltip: "DataFormatServer",
            labelAlign: "right"
        },
        {
            id: "predator",
            view: "text",
            value: "",
            label: "PreExperimentDataCollector",
            labelWidth: 120,
            tooltip: "PreExperimentDataCollector",
            labelAlign: "right"
        },
        {
            cols: [
                {},
                {
                    view: "button",
                    value: "Apply",
                    maxWidth:120,
                    click(){
                        this.getTopParentView().applySettings();
                    }
                }
            ]
        }
    ]
};

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

export const xenvHqBottom = {
    view: "button",
    value: "Update & Restart all",
    minHeight: 80,
    click() {
        this.getTopParentView().updateAndRestartAll()
    }
};
