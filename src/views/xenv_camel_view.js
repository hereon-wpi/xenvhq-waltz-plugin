import {newXenvServerLog, newXmlView} from "./xenv_views.js";
import {TangoId} from "@waltz-controls/tango-rest-client";
import {WaltzWidgetMixin} from "@waltz-controls/waltz-webix-extensions";

/**
 *
 * @author Igor Khokhriakov <igor.khokhriakov@hzg.de>
 * @since 3/27/19
 */


const camel_view = webix.protoUI({
    name: "camel_view",
    async update() {
        const rest = await this.getTangoRest();

        rest.newTangoDevice(TangoId.fromDeviceId(this.config.configurationManager.id))
            .newAttribute("camelRoutesXml")
            .read()
            .subscribe(resp => {
                this.$$('xml').update(resp.value);
            });
    },
    _ui(){
        return {
            rows:[
                newXmlView(),
                {view: "resizer"},
                newXenvServerLog()
            ]
        }
    },
    $init(config) {
        webix.extend(config, this._ui());

        this.$ready.push(() => {
            this.$$('log').data.sync(config.root.view.$$('log'), function(){
                this.filter(server => server.name === 'CamelIntegration')
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

export function newCamelIntegrationViewBody(config){
    return webix.extend({
        view: "camel_view"
    },config);
}