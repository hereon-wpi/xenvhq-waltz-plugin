import {newXenvServerLog, newXmlView} from "./xenv_views.js";
import {WaltzWidgetMixin} from "@waltz-controls/waltz-webix-extensions";
import {TangoId} from "@waltz-controls/tango-rest-client";

/**
 *
 * @author Igor Khokhriakov <igor.khokhriakov@hzg.de>
 * @since 3/27/19
 */


const status_server_view = webix.protoUI({
    name: "status_server_view",
    async update() {
        const rest = await this.getTangoRest();

        rest.newTangoDevice(TangoId.fromDeviceId(this.config.configurationManager.id))
            .newAttribute("statusServerXml")
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
                this.filter(server => server.name === 'StatusServer2')
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

export function newStatusServerViewBody(config){
    return webix.extend({
        view: "status_server_view"
    },config);
}
