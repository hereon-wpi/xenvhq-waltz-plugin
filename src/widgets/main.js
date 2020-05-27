import {WaltzWidget} from "@waltz-controls/middleware";
import {newXenvHqBody, newXenvHqBottom, newXenvHqLeftPanel} from "views/xenv_views";
import {TangoId} from "@waltz-controls/tango-rest-client";
import {
    kChannelLog,
    kMainWindow,
    kTopicError,
    kTopicLog,
    kWidgetXenvHq,
    kXenvHqPanelId,
    kXenvLeftPanel
} from "widgets/xenv";
import {kTangoRestContext} from "@waltz-controls/waltz-tango-rest-plugin";
import {concat, from, Subject} from "rxjs";
import {filter, groupBy, map, mergeMap, reduce} from "rxjs/operators"
import {BoundedReverseList} from "@waltz-controls/waltz-webix-extensions";

const kWidgetXenvHqMain = 'widget:xenvhq:main';

const kSubject = new Subject();
const kAnyTopic = "*";
const findAll = () => true;

/**
 * @type XenvHqMainWidget
 * @property {webix.ui} $$body
 */
export default class XenvHqMainWidget extends WaltzWidget {
    constructor(app) {
        super(kWidgetXenvHqMain, app);

        this.root = app.getWidget(kWidgetXenvHq);

        const collectionsProxy = {
            $proxy: true,
            load: (view, params, dp) => {
                view.clearAll();
                return this.getTangoRest()
                    .then(rest => rest.newTangoAttribute(this.getConfigurationManagerId().setName("dataSourceCollections"))
                        .toTangoRestApiRequest()
                        .value()
                        .get('', {
                            headers: {
                                "Accept": "text/plain"
                            }
                        })
                        .toPromise());
            },
            save: (view, params, dp) => {
                switch (params.operation) {
                    case "insert":
                        return ((params.data.value) ?
                            this.cloneCollection(params.id, params.data.value) :
                            this.selectCollection(params.id).then(resp => this.collections.updateItem(params.id, resp)))
                            .then(() => this.collections.updateItem(params.id, {value: params.id}));
                    case "delete":
                        return this.getTangoRest()
                            .then(rest => rest.newTangoDevice(this.getConfigurationManagerId())
                                .newCommand('deleteCollection')
                                .execute(params.id)
                                .toPromise())

                }
            },
            // updateFromResponse: true//TODO does this work?
        }
        this.collections = new webix.DataCollection({
            url: collectionsProxy,
            save: collectionsProxy,
            on: {
                onAfterLoad: () => {
                    this.loadSelectedCollections();
                }
            }
        });

        this.listen(update => {
            kSubject.next(update);
            //TODO error
        }, kAnyTopic, `${kWidgetXenvHq}.status.subscription`);

        kSubject.pipe(
            filter(update => update.name || update.status),
            map(update => update.name && update.name === 'Status' ? Object.assign(update, {status: update.data})  : update)
        ).subscribe(update => {
            const id = `${update.host}/${update.device}`;
            const [timestamp, value] = update.status.split(": ");

            const {name} = this.servers.getItem(id);

            this.view.$$('log').addFirst({
                name,
                value,
                timestamp
            });
        })
    }

    get view() {
        return this.root.view;
    }

    get $$panel() {
        return $$(kXenvHqPanelId);
    }

    get $$settings() {
        return this.root.$$settings;
    }

    get servers() {
        return this.root.servers;
    }

    getConfigurationManagerId() {
        return TangoId.fromDeviceId(this.root.configurationManager.id);
    }

    getTangoRest() {
        return this.app.getContext(kTangoRestContext);
    }

    ui() {
        return {
            rows: [
                newXenvHqBody({
                    root: this,
                    configurationManager: this.root.configurationManager,
                    dataFormatServer: this.root.data_format_server
                }),
                newXenvHqBottom({
                    root: this
                })
            ]
        }
    }

    leftPanel() {
        return newXenvHqLeftPanel({
            root: this
        });
    }

    run() {
        //OK
        this.initializeLeftPanel();


        this.$$body = this.$$body || $$(this.view.addView(this.ui()));
        this.$$body.show();

        webix.extend(this.view.$$('log'), BoundedReverseList);
    }

    initializeLeftPanel() {
        const panel = $$(kXenvLeftPanel) || $$(this.app.getWidget(kMainWindow).leftPanel.addView(this.leftPanel()));

        this.$$panel.$$('list').data.sync(this.collections);

        this.$$panel.$$('frmCollectionSettings').bind(this.$$panel.$$('list'));
    }

    updateStateStatus(){
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
                this.dispatch({
                    ...update,
                    data: update.status
                }, `${server.name}.Status`, `${kWidgetXenvHq}.status.subscription`);

                this.dispatch({
                    ...update,
                    data: update.state
                }, `${server.name}.State`, `${kWidgetXenvHq}.state.subscription`);
            })
        )
            .catch(e => {
                debugger
            })
    }

    async updateAndRestartAll() {
        if (!this.root.main) {
            this.dispatch("Can not perform action: main server has not been set!", kTopicLog, kChannelLog);
            return;
        }

        const collections = this.view.$$('main_tab').prepareCollections();

        const rest = await this.getTangoRest();

        const main = rest.newTangoDevice(TangoId.fromDeviceId(this.root.main.id));
        const updateProfileCollections = rest.newTangoDevice(this.getConfigurationManagerId()).newCommand("selectCollections");
        const stopAll = main.newCommand("stopAll");
        const clearAll = main.newCommand("clearAll");
        const updateAll = main.newCommand("updateAll");
        const startAll = main.newCommand("startAll");

        concat(
            updateProfileCollections.execute(collections),
            // stopAll.execute(),
            // clearAll.execute(),
            // updateAll.execute(),
            // startAll.execute()
        ).subscribe({
            next: () => {
                this.dispatch("Successfully updated and restarted Xenv!", kTopicLog, kChannelLog);
            },
            error: () => {
                this.dispatchError("Failed to updated and restarted Xenv!", kTopicError, kChannelLog);
            }
        });
    }

    /**
     *
     * @param {{id, value}} collection
     * @return {Promise<void>}
     */
    addCollection(collection) {
        return this.collections.add(collection);
    }

    async loadSelectedCollections(){
        const rest = await this.getTangoRest();
        return rest.newTangoDevice(this.getConfigurationManagerId())
            .newAttribute("selectedCollections")
            .read()
            .pipe(
                mergeMap(resp => JSON.parse(resp.value))
            ).subscribe(update => {
                this.collections.updateItem(update.id, {markCheckbox: update.value})
            });

    }

    /**
     *
     * @param {string} collectionId
     * @return {Promise<void>}
     */
    async selectCollection(collectionId) {
        const rest = await this.getTangoRest();
        return rest.newTangoDevice(this.getConfigurationManagerId())
            .newAttribute("datasourcescollection")
            .write(collectionId)
            .toPromise()
            .then(() => this.collections.setCursor(collectionId))
            .then(() => this.view.$$('datasources').update(collectionId));
    }


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
        }).then(() => {
            this.collections.remove(collection);
        }).then(() => {
            this.view.$$('datasources').reset();
        });
    }

    cloneCollection(collection, source) {
        return this.getTangoRest()
            .then(rest => rest.newTangoDevice(this.getConfigurationManagerId())
                .newCommand('cloneCollection')
                .execute([collection, source])
                .toPromise())
    }
}