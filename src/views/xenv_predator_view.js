import {codemirror_textarea, WaltzWidgetMixin} from "@waltz-controls/waltz-webix-extensions";
import 'codemirror/mode/yaml/yaml.js';
/**
 *
 * @author Igor Khokhriakov <igor.khokhriakov@hzg.de>
 * @since 3/27/19
 */
import {newXenvServerLog} from "./xenv_views.js";
import {TangoId} from "@waltz-controls/tango-rest-client";

const meta_yaml = webix.protoUI({
    name: "meta_yaml",
    update(value) {
        if (!value) return;
        this.setValue(value);
    }
}, codemirror_textarea);

function newMetaYamlView() {
    return {
        gravity: 2,
        rows: [
            {
                view: "meta_yaml",
                id: "meta_yaml",
                mode: "text/x-yaml"
            },
            {
                cols: [
                    {},
                    {
                        view: "button",
                        type: "icon",
                        icon: "save",
                        align: "right",
                        width: 30,
                        click() {
                            TangoWebappHelpers.error("Not yet supported!");
                            // this.getTopParentView().save();
                        }
                    }
                ]
            }
        ]
    }
}


const predator_view = webix.protoUI({
    name: "predator_view",
    async update() {
        const rest = await this.getTangoRest();

        rest.newTangoDevice(TangoId.fromDeviceId(this.config.configurationManager.id))
            .newAttribute("preExperimentDataCollectorYaml")
            .read()
            .subscribe(resp => {
                this.$$('meta_yaml').update(resp.value);
            });
    },
    async save(){
        const value = this.$$('meta_yaml').getValue();

        this.config.configurationManager.writePreExperimentDataCollectorYaml(value)
            // .then(() => {
            //     this.config.master.commitConfiguration()
            // })
            // .then(() => {
            //     this.config.master.pushConfiguration()
            // });
    },
    _ui(){
        return {
            rows:[
                newMetaYamlView(),
                {view: "resizer"},
                newXenvServerLog()
            ]
        }
    },
    $init(config) {
        webix.extend(config, this._ui());

        this.$ready.push(() => {
            this.$$('log').data.sync(config.root.view.$$('log'), function(){
                this.filter(update => update.name === 'PreExperimentDataCollector')
            }.bind(this.$$('log')));
        });
    },
    defaults: {
        on: {
            onViewShow() {
                this.update();
            }
        }
    }
}, WaltzWidgetMixin, webix.IdSpace, webix.ui.layout);

export function newPredatorViewBody(config){
    return webix.extend({
        view: "predator_view"
    },config);
}
