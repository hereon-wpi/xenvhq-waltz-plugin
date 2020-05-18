import {Application, WaltzWidget} from "@waltz-controls/middleware";
import {XenvHqWidget} from "codebase/index";

const userContext = {
    user: "tango-cs",
    ext:{}
};

const mainWidget = new class extends WaltzWidget{
    constructor() {
        super("widget:main");
    }


    run(){
        this.mainView = webix.ui({
            view:'tabview',
            cells: [{}]
        });
    }
}

new Application({name: "Test XenvHQ", version: "1.0.0"})
    .registerContext("context:user_context", userContext)
    .registerWidget(mainWidget)
    .registerWidget(new XenvHqWidget())
    .run()
