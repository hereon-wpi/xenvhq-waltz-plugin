/**
 *
 * @author Igor Khokhriakov <igor.khokhriakov@hzg.de>
 * @since 04.09.2019
 */

import {newSearch, WaltzWidgetMixin} from "@waltz-controls/waltz-webix-extensions";
import {DataSource} from "./xenv_models.js";
import {TangoId} from "@waltz-controls/tango-rest-client";
import {kTopicLog} from "widgets/xenv";
import {kChannelLog} from "@waltz-controls/waltz-user-context-plugin";

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
                const values = this.getValues();
                Object.entries(values).filter(pair => pair[1].trim !== undefined)
                    .forEach(([key, value]) => {
                        values[key] = value.trim()
                    })
                this.setValues(values,true);
            }
        },
        elements: [
            {cols:[
                    { view: "label", label: "src ", maxWidth: 80 },
                    {view: "combo", name: "srcScheme", maxWidth: 120, options: [
                            "tine:", "tango:", "predator:", "external:"
                        ], validate: webix.rules.isNotEmpty},
                    {view: "text", required:true, name: "srcPath"},
                ]},
            {view: "text", name: "nxPath", label: "nxPath", required: true, validate: webix.rules.isNotEmpty},
            {
                view: "radio", name: "type", label: "type", required: true, options: [
                    "scalar", "spectrum", "log"
                ], validate: webix.rules.isNotEmpty
            },
            {view: "text", name: "pollRate", label: "pollRate", required: true, validate: webix.rules.isNumber},
            {
                view: "select", name: "dataType", label: "dataType", required: true, options: [
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
                            if (parent.$$("list").getSelectedId() == obj.id &&
                                parent.existsDataSource(obj.id)) {
                                    parent.updateDataSource(obj);
                            } else {
                                obj.id = obj.id ? obj.id : webix.uid();
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
                if (obj && obj._id) obj.id = obj._id;//copy mongodb _id
            }
        },
        on: {
            onItemClick(id) {
                if (this.getSelectedId() === id) {
                    this.unselectAll();
                } else {
                    this.select(id);
                }
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
            this.getTopParentView().$$('list').sort(by, this.config.dir);
            this.config.dir = this.config.dir === "asc" ? "desc" : "asc";
        }
    }
}

function newSort() {
    return {
        view: "form",
        height: 30,
        type: 'clean',
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

function newHeader(){
    return {
        view: "template",
        id:'header',
        height: 30,
        type: 'header',
        template: "DataSources collection: #id#"
    }
}

const datasources_view = webix.protoUI({
    name: "datasources_view",
    _ui(){
        return {
            rows: [
                newHeader(),
                newSort(),//TODO replace with smart filter
                newSearch("list", filterDataSourcesList),
                newDataSourcesList(this),
                newDataSourceForm(this)
            ]
        }
    },

    setCollection() {
        if (!this.collectionId) {
            this.config.root.dispatchError("no XenvHQ DataSources Collection is selected!", kTopicLog, kChannelLog)
            throw new Error("no XenvHQ DataSources Collection is selected!");
        }
        return this.config.root.selectCollection(this.collectionId);
    },

    processDataSource(operation, dataSource) {
        return this.setCollection()
            .then(() => this.getTangoRest())
            .then(rest => rest.newTangoDevice(TangoId.fromDeviceId(this.config.configurationManager.id))
                .newCommand(`${operation}datasource`)//insert|update|delete
                .execute(JSON.stringify(dataSource))
                .toPromise())
    },
    existsDataSource(id){
        return this.datasources.exists(id)
    },
    addDataSource(dataSource) {
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
    async dropAttr(id) {
        const rest = await this.getTangoRest();
        const data_type = await rest.newTangoAttribute(id).toTangoRestApiRequest()
            .get('?filter=data_type')
            .toPromise();

        this.addDataSource(new DataSource(
            webix.uid(),
            `tango://${id.getTangoMemberId()}`,
            `/entry/hardware/${id.getTangoDeviceName()}/${id.name}`,
            "log",
            200,
            DataSource.devDataTypeToNexus(data_type.info.data_type)))
            .then(id => {
                this.$$('list').select(id);
            });
    },
    reset() {
        this.datasources.clearAll();
        this.$$('frmDataSource').clear();
        this.disable();
    },
    update(collectionId) {
        this.enable();
        if (this.collectionId === collectionId) return;
        this.collectionId = collectionId;
        this.$$('header').setValues({
            id:collectionId
        });
        this.datasources.clearAll();
        this.datasources.parse(this.getTangoRest()
            .then(rest => rest.newTangoAttribute(TangoId.fromDeviceId(this.config.configurationManager.id).setName('datasources'))
                .toTangoRestApiRequest()
                .value()
                .get('', {
                    headers: {
                        "Accept": "text/plain"
                    }
                }).toPromise()))
    },
    $init(config) {
        webix.extend(config, this._ui());

        this.collectionId = undefined;
        this.datasources = new webix.DataCollection();


        this.$ready.push(() => this.disable());

        this.$ready.push(() => {
            this.$$('list').sync(this.datasources);
        })

        this.$ready.push(() => {
            this.$$('frmDataSource').bind(this.$$('list'));
        });

        this.addDrop(this.getNode(), {
            /**
             * @function
             */
            $drop: function (source, target) {
                var dnd = webix.DragControl.getContext();
                if(dnd.from.config.$id === 'attrs') {
                    this.dropAttr(TangoId.fromMemberId(dnd.source[0]));
                }

                return false;
            }.bind(this)
        });
    }
}, WaltzWidgetMixin, webix.DragControl, webix.IdSpace, webix.ui.layout);

export function newDataSourcesBody(config){
    return webix.extend({
        view: "datasources_view",
        id: "datasources"
    },config);
}
