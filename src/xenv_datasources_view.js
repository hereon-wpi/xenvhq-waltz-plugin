/**
 *
 * @author Igor Khokhriakov <igor.khokhriakov@hzg.de>
 * @since 04.09.2019
 */

import {newSearch, WaltzWidgetMixin} from "@waltz-controls/waltz-webix-extensions";
import {DataSource} from "./xenv_models.js";
import {TangoId} from "@waltz-controls/tango-rest-client";
import {concatMap} from "rxjs/operators";

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
        id: "listDataSources",
        template:
            "<span class='webix_strong'>Src: </span>#src#<br/>" +
            "<span class='webix_strong'>nxPath: </span>#nxPath#",
        gravity: 4,
        type: {
            height: "auto"
        },
        scheme:{
            // add
            $init(obj){
                obj.id = obj._id;//copy mongodb _id
            }
        },
        on: {
            onItemClick(id){
                if(this.getSelectedId() === id){
                    this.unselectAll();
                } else {
                    this.select(id);
                }
            },
            onAfterSelect(id){
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


function newDataSourceCollectionForm(parent){
    return {
        view: "form",
        id: "frmCollectionSettings",
        hidden: true,
        elements: [
            {
                cols: [
                    {
                        view: "text",
                        name: "id",
                        label: "DataSources collection id",
                        labelAlign: "right",
                        labelWidth: 200,
                        validate: webix.rules.isNotEmpty
                    },
                    {
                        view: "text",
                        id: "txtCollectionProto",
                        name: "value",
                        label: "Copy from",
                        labelAlign: "right",
                        suggest:{
                            id:"txtCollectionProtoSuggest",
                            data:[]
                        },
                        on:{
                            onItemClick:function(){
                                //link suggest to the input
                                $$(this.config.suggest).config.master = this;
                                //show
                                $$(this.config.suggest).show(this.$view)
                            }
                        }
                    }
                ]
            },
            {
                cols: [
                    {},
                    {
                        view: "icon",
                        id: 'btnAddProfile',
                        icon: "mdi mdi-content-save",
                        maxWidth: 30,
                        click() {
                            const $$frm = this.getFormView();
                            if (!$$frm.validate()) return;

                            const values = $$frm.getValues();

                            let promise;
                            if(values.value)
                                promise = parent.cloneCollection(values.id, values.value);
                            else
                                promise = parent.selectCollection(values.id);

                            promise.then(() => {
                                parent.collections.add({
                                    id: values.id,
                                    value: values.id
                                });

                                parent.$$('selectDataSources').setValue(values.id);
                            });
                        }
                    },
                    {
                        view: "icon",
                        id: 'btnRmProfile',
                        icon: "mdi mdi-delete",
                        maxWidth: 30,
                        click() {
                            const $$frm = this.getFormView();
                            if (!$$frm.validate()) return;

                            const values = $$frm.getValues();

                            //TODO #172
                            // webix.modalbox({
                            //     title:"<span><span class='webix_icon fa-exclamation-circle'> Attention</span>",
                            //     buttons:["Yes", "No"],
                            //     width:500,
                            //     text:`<p>This will drop the ${values.id} collection and all DataSources will be deleted! Proceed?</p>`
                            // }).then(() => {
                                parent.deleteCollection(values.id).then(() => {
                                    parent.collections.remove(values.id);
                                    parent.datasources.clearAll();
                                    parent.$$('selectDataSources').setValue("");
                                });
                            // });
                        }
                    }
                ]
            }
        ]
    };
}

function newToolbar(parent){
    return {
        view:"toolbar",
        cols:[
            {
                view:"combo",
                id: "selectDataSources",
                options:{
                    body: {
                        template:"#id#"
                    },
                    data:[]
                },
                on:{
                    onItemClick:function(){
                        //link suggest to the input
                        $$(this.config.suggest).config.master = this;
                        //show
                        $$(this.config.suggest).show(this.$view)
                    }
                }
            },
            {
                view: "icon",
                icon: "mdi mdi-plus",
                click(){
                    // const collection = parent.$$('selectDataSources').getValue();
                    // if(!collection) webix.message("<span class='webix_icon fa-bell'></span> Please specify the collection!");
                    // else parent.selectCollection(collection);
                    const $$form = this.getTopParentView().$$('frmCollectionSettings');
                    if($$form.isVisible())
                        $$form.hide();
                    else
                        $$form.show()
                }
            },
            {}
        ]
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
                newToolbar(this),
                newDataSourceCollectionForm(this),
                newSort(),//TODO replace with smart filter
                newSearch("listDataSources", filterDataSourcesList),
                newDataSourcesList(this),
                newDataSourceForm(this)
            ]
        }
    },
    async selectCollection(collection) {
        const rest = await this.getTangoRest();
        rest.newTangoDevice(TangoId.fromDeviceId(this.config.configurationManager.id))
            .newAttribute("datasourcescollection")
            .write(collection).pipe(
            concatMap(() => rest.newTangoDevice(TangoId.fromDeviceId(this.config.configurationManager.id))
                .newAttribute("datasources")
                .read())
        ).subscribe(resp => {
            this.datasources.clearAll();
            this.datasources.parse(resp.value);
        });
    },
    /**
     *
     * @return {Promise<*>}
     */
    setCollection() {
        const collection = this.$$('selectDataSources').getValue();
        return this.getTangoRest()
            .then(rest => rest.newTangoDevice(TangoId.fromDeviceId(this.config.configurationManager.id))
                .newAttribute("datasourcescollection")
                .write(collection).toPromise());
    },
    deleteCollection(collection) {
        return new Promise(function (success, fail) {
            webix.modalbox({
                buttons: ["No", "Yes"],
                width: 500,
                text: `<span class='webix_icon fa-exclamation-circle'></span><p>This will delete data sources collection ${collection} and all associated data sources! Proceed?</p>`,
                callback: function (result) {
                    if (result === "1") success();
                }
            });
        }).then(() => this.getTangoRest())
            .then(rest => rest.newTangoDevice(TangoId.fromDeviceId(this.config.configurationManager.id))
                .newCommand('deleteCollection')
                .execute()
                .toPromise()
            );
    },
    cloneCollection(collection, source) {
        return this.getTangoRest()
            .then(rest => rest.newTangoDevice(TangoId.fromDeviceId(this.config.configurationManager.id))
                .newCommand('cloneCollection')
                .execute([collection, source])
                .toPromise())
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
            .then(id=>{
                $$list.select(id);
            });
    },
    $init(config) {
        webix.extend(config, this._ui());

        const collectionsProxy = {
            $proxy: true,
            load: async () => {
                const rest = await config.root.getTangoRest();
                return rest.newTangoDevice(TangoId.fromDeviceId(config.configurationManager.id))
                    .newAttribute("datasourcecollections")
                    .read()
                    .toPromise()
                    .then(resp => resp.value)
            },
            save: () => {
                debugger
            }
        }

        this.collections = new webix.DataCollection({
            url: collectionsProxy,
            save: collectionsProxy
        });
        this.datasources = new webix.DataCollection();

        this.$ready.push(() => {
            const list = this.$$("selectDataSources").getPopup().getList();

            list.attachEvent("onAfterSelect", id => {
                this.selectCollection(id);
                this.collections.setCursor(id);
            });
            list.sync(this.collections);

            this.$$("txtCollectionProtoSuggest").getList().sync(this.collections);
            this.$$("frmCollectionSettings").bind(list);


            this.$$("listDataSources").sync(this.datasources);
            this.$$("frmDataSource").bind(this.datasources);
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
        id:"datasources_view_tab"
    },config);
}
