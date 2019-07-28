import React from "react";
import { Switch, Route, HashRouter, RouteComponentProps, withRouter } from "react-router-dom";

import { routeNames } from "./routes";
import { IWithAppStateProps, withAppState } from "./containers/with-app-state";

import { IndexPage } from "./pages";
import { PlayerPage } from "./pages/player";
import { PlanetPage } from "./pages/planet";
import { NotFoundPage } from "./pages/not-found";
import { HomeBasePage } from "./pages/home-base";
import { UploadPage } from "./pages/upload";
import { DownloadPage } from "./pages/download";
import { LevelPage } from "./pages/level";
import { MainMenuPage } from "./pages/main-menu";

type Props = IWithAppStateProps;

class RouterBase extends React.Component<Props> {
	public render(): React.ReactNode {
		return (
			<HashRouter>
				<Switch>
					<Route exact path={routeNames.Index} component={IndexPage} />
					<Route exact path={routeNames.MainMenu} component={MainMenuPage} />
					<Route exact path={routeNames.Guide} component={PlayerPage} />
					<Route exact path={routeNames.Planet} component={PlanetPage} />
					<Route exact path={routeNames.Headquarters} component={HomeBasePage} />
					<Route exact path={routeNames.Upload} component={UploadPage} />
					<Route exact path={routeNames.Download} component={DownloadPage} />
					<Route exact path={routeNames.LevelCurve} component={LevelPage} />
					<Route component={NotFoundPage} />
				</Switch>
			</HashRouter>
		);
	}
};

export const Router = withAppState(RouterBase);