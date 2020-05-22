/**
 *
 * @author Igor Khokhriakov <igor.khokhriakov@hzg.de>
 * @since 04.09.2019
 */

import {newSearch, WaltzWidgetMixin} from "@waltz-controls/waltz-webix-extensions";
import {DataSource} from "./xenv_models.js";
import {TangoId} from "@waltz-controls/tango-rest-client";
import {newTangoAttributeProxy} from "./index";

/**
 *
 *
 * @param {DataSource} dataSource
 * @param {string} value
 * @function
 */
const filterDataSourcesList = (dataSource, value) => {
    if (!value) return true;
    return dataSource.src.includes(value) || dataSource.nxPath.includes(value);
};

function newDataSourceForm(parent){
    return {
        view: "form",
        id: "frmDataSource",
        on:{
            onBindApply(obj){
                if(!obj) return;
                this.setValues({
                    srcScheme:this.elements['srcScheme'].getList().find(option => obj.src.startsWith(option.value), true).value,
                    srcPath  : obj.src.substring(obj.src.indexOf(':') + 1)
                }, true);
            },
            onBeforeValidate(){
                this.setValues({
                    src: `${this.elements['srcScheme'].getValue()}${this.elements['srcPath'].getValue()}`
                },true);
            }
        },
        elements: [
            {cols:[
                    { view: "label", label: "src", maxWidth: 80 },
                    {view: "combo", name: "srcScheme", maxWidth: 120, options: [
                            "tine:", "tango:", "predator:", "external:"
                        ], validate: webix.rules.isNotEmpty},
                    {view: "text", name: "srcPath"},
                ]},
            {view: "text", name: "nxPath", label: "nxPath", validate: webix.rules.isNotEmpty},
            {
                view: "radio", name: "type", label: "type", options: [
                    "scalar", "spectrum", "log"
                ], validate: webix.rules.isNotEmpty
            },
            {view: "text", name: "pollRate", label: "pollRate", validate: webix.rules.isNumber},
            {
                view: "select", name: "dataType", label: "dataType", options: [
                    "string", "int16", "int32", "int64", "uint16", "uint32", "uint64", "float32", "float64"
                ]
            },
            {
                cols: [
                    {},
                    {
                        view: "icon", width: 30, icon: "mdi mdi-content-save", tooltip: "save", click() {
                            const $$form = this.getFormView();
                            // $$form.save();

                            if (!$$form.validate()) return;

                            const obj = $$form.getValues();
                            if (parent.$$("listDataSources").getSelectedId() == obj.id) {
                                parent.updateDataSource(obj);
                            } else {
                                obj.id = webix.uid();
                                parent.addDataSource(obj);
                            }
                        }
                    },
                    {
                        view: "icon", width: 30, icon: "mdi mdi-checkbox-multiple-blank-outline", tooltip: "clone", click(){
                            const $$form = this.getFormView();
                            if(!$$form.validate()) return;

                            const cloned = $$form.getValues();
                            cloned.id = webix.uid();

                            parent.addDataSource(cloned);
                        }
                    },
                    {
                        view: "icon", width: 30, icon: "mdi mdi-delete", tooltip: "delete", click(){
                            const $$form = this.getFormView();
                            const id = $$form.getValues().id;
                            parent.deleteDataSource({id})
                                .then(() => {
                                    $$form.clear();
                                });
                        }
                    }
                ]
            }
        ]
    };
}

function newDataSourcesList(parent){
    return {
        view: "list",
        id: "list",
        template:
            "<span class='webix_strong'>Src: </span>#src#<br/>" +
            "<span class='webix_strong'>nxPath: </span>#nxPath#",
        gravity: 4,
        type: {
            height: "auto"
        },
        scheme: {
            // add
            $init(obj) {
                obj.id = obj._id;//copy mongodb _id
            }
        },
        on: {
            onBindApply(obj) {
                debugger
                if (!obj) return;
                //TODO check argument?
                this.load(
                    newTangoAttributeProxy(
                        parent.getTangoRest(),
                        TangoId.fromDeviceId(parent.config.configurationManager.id).setName('datasources')))
            },
            onItemClick(id) {
                if (this.getSelectedId() === id) {
                    this.unselectAll();
                } else {
                    this.select(id);
                }
            },
            onAfterSelect(id) {
                parent.datasources.setCursor(id);
            },
            onBlur(){
                // $$hq.pushConfiguration();
            }
        }
    };
}

const dataSourcesProxy = {
        $proxy: true,
        load(view, params) {
            //TODO
        },
        save(view, params, dp) {
            switch (params.operations) {
                case "insert":
                    
            }
        },
        result() {

        }
}




function newSortButton(by) {
    return {
        view: "button",
        css: "webix_transparent",
        type: "icon",
        label: `<span class='webix_strong'>${by}</span>`,
        dir: "asc",
        click() {
            this.getTopParentView().$$('listDataSources').sort(by, this.config.dir);
            this.config.dir = this.config.dir === "asc" ? "desc" : "asc";
        }
    }
}

function newSort() {
    return {
        view: "form",
        height: 30,
        cols: [
            {
                view: "label",
                label: "Sort by:",
                maxWidth: 80,
            },
            newSortButton('src'),
            newSortButton('nxPath'),
            {}
        ]
    }
}

const datasources_view = webix.protoUI({
    name: "datasources_view",
    _ui(){
        return {
            rows: [
                newSort(),//TODO replace with smart filter
                newSearch("listDataSources", filterDataSourcesList),
                newDataSourcesList(this),
                newDataSourceForm(this)
            ]
        }
    },

    processDataSource(operation, dataSource){
        return this.setCollection()
            .then(() => this.getTangoRest())
            .then(rest => rest.newTangoDevice(TangoId.fromDeviceId(this.config.configurationManager.id))
                .newCommand(`${operation}datasource`)//insert|update|delete
                .execute(JSON.stringify(dataSource))
                .toPromise())
    },
    addDataSource(dataSource){
        return this.processDataSource("insert",dataSource)
            .then(() => {
                return this.datasources.add(dataSource)
            })
    },
    updateDataSource(dataSource){
        return this.processDataSource("update", dataSource)
            .then(() => {
                this.datasources.updateItem(dataSource.id, dataSource);
            })
    },
    deleteDataSource(dataSource){
        return this.processDataSource("delete", dataSource).
            then(() => {
                this.datasources.remove(dataSource.id);
        })
    },
    /**
     *
     * @param {TangoId} id
     */
    dropAttr(id){
        const attr = TangoAttribute.find_one(id);
        if(attr == null) return;

        const device = TangoDevice.find_one(attr.device_id);
        const $$list = this.$$('listDataSources');
        this.addDataSource(new DataSource(
            webix.uid(),
            `tango://${attr.id}`,
            `/entry/hardware/${device.name}/${attr.name}`,
            "log",
            200,
            DataSource.devDataTypeToNexus(attr.info.data_type)))
            .then(id => {
                $$list.select(id);
            });
    },
    update() {
        // this.datasources.clearAll();
        // this.datasources.parse(
        //     this.getTangoRest().then(rest => rest.newTangoDevice(TangoId.fromDeviceId(this.configurationManager.id))
        //         .newAttribute("datasources")
        //         .read()
        //         .pipe(
        //             map(resp => resp.value)
        //         )
        //         .toPromise()));


    },

    $init(config) {
        webix.extend(config, this._ui());

        this.$ready.push(() => {
            // const list = this.$$("selectDataSources").getPopup().getList();
            //
            // list.attachEvent("onAfterSelect", id => {
            //     this.selectCollection(id);
            //     this.collections.setCursor(id);
            // });
            // list.sync(this.collections);
            //
            // this.$$("txtCollectionProtoSuggest").getList().sync(this.collections);
            // this.$$("frmCollectionSettings").bind(list);


            this.$$('frmDataSource').bind(this.$$('list'));
        });

        this.addDrop(this.getNode(),{
            /**
             * @function
             */
            $drop:function(source, target){
                var dnd = webix.DragControl.getContext();
                if(dnd.from.config.$id === 'attrs') {
                    this.dropAttr(dnd.source[0]);
                }

                return false;
            }.bind(this)
        });
    },
    defaults: {
        on: {
            onViewShow() {
                //TODO
                // if (this.config.configurationManager.device == null) return;
                // this.collections.load(newTangoAttributeProxy(PlatformContext.rest, this.config.host, this.config.device, "datasourcecollections"));
            }
        }
    }
}, WaltzWidgetMixin, webix.DragControl, webix.IdSpace, webix.ui.layout);

export function newDataSourcesBody(config){
    return webix.extend({
        view: "datasources_view",
        id: "datasources"
    },config);
}
