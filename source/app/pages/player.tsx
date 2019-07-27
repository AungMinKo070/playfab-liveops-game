import React from "react";
import { TextField } from 'office-ui-fabric-react/lib/TextField';
import { PrimaryButton, MessageBar, MessageBarType, Spinner } from 'office-ui-fabric-react';
import { is } from "../shared/is";
import { Redirect } from "react-router";
import { routes } from "../routes";
import { PlayFabHelper } from "../shared/playfab";
import { RouteComponentProps } from "react-router";
import { Page } from "../components/page";
import { DivConfirm, UlInline } from "../styles";
import { IWithAppStateProps, withAppState } from "../containers/with-app-state";
import { actionSetPlayerId, actionSetPlayerName, actionSetCatalog, actionSetInventory, actionSetPlanetsFromTitleData, actionSetStoreNamesFromTitleData, actionSetPlayerHP, actionSetEnemiesFromTitleData, actionSetEquippedArmor, actionSetEquippedWeapon } from "../store/actions";
import { TITLE_DATA_PLANETS, CloudScriptFunctionNames, CATALOG_VERSION, TITLE_DATA_STORES, TITLE_DATA_ENEMIES } from "../shared/types";
import { IWithPageProps, withPage } from "../containers/with-page";
import { IPlayerLoginResponse } from "../../cloud-script/main";

type Props = RouteComponentProps & IWithAppStateProps & IWithPageProps;

interface IState {
    playerName: string;
    isLoggingIn: boolean;
    equipArmor: string;
    equipWeapon: string;
}

class PlayerPageBase extends React.Component<Props, IState> {
    constructor(props: Props) {
        super(props);

        this.state = {
            playerName: null,
            isLoggingIn: false,
            equipArmor: null,
            equipWeapon: null,
        };
    }

    public componentDidUpdate(): void {
        const shouldTryAndEquip = !is.null(this.props.appState.catalog) && (!is.null(this.state.equipArmor) || !is.null(this.state.equipWeapon));

        if(shouldTryAndEquip) {
            if(!is.null(this.state.equipArmor)) {
                this.props.dispatch(actionSetEquippedArmor(this.props.appState.catalog.find(i => i.ItemId === this.state.equipArmor)));

                this.setState({
                    equipArmor: null,
                });
            }
            if(!is.null(this.state.equipWeapon)) {
                this.props.dispatch(actionSetEquippedWeapon(this.props.appState.catalog.find(i => i.ItemId === this.state.equipWeapon)));

                this.setState({
                    equipWeapon: null,
                });
            }
        }
    }

    public render(): React.ReactNode {
        if(!this.isValid()) {
            return <Redirect to={routes.Home} />;
        }

        return (
            <Page {...this.props}>
                <h2>
                    {this.props.appState.hasPlayerId
                        ? "Choose Your Destination"
                        : "Play Game"}
                </h2>
                {!is.null(this.props.pageError) && (
                    <MessageBar messageBarType={MessageBarType.error}>{this.props.pageError}</MessageBar>
                )}
                {this.props.appState.hasPlayerId
                    ? this.renderPlanetMenu()
                    : this.renderPlayerLogin()}
            </Page>
        );
    }

    private renderPlayerLogin(): React.ReactNode {
        return (
            <form onSubmit={this.login}>
                <p>Start by entering a player ID. This can be a name (e.g. "James"), a GUID, or any other string.</p>
                <p>Type a player ID you've used before to load that player's data, or enter a new one to start over.</p>
                <p>This login happens using <a href="https://api.playfab.com/documentation/client/method/LoginWithCustomID">Custom ID</a>.</p>
                <fieldset>
                    <legend>Player</legend>
                    <TextField label="Player ID" onChange={this.setLocalPlayerID} autoFocus />
                    <DivConfirm>
                        {this.state.isLoggingIn
                            ? <Spinner label="Logging in" />
                            : <PrimaryButton text="Login" onClick={this.login} />}
                    </DivConfirm>
                </fieldset>
            </form>
        );
    }

    private renderPlanetMenu(): React.ReactNode {
        if(is.null(this.props.appState.planets)) {
            return <Spinner label="Loading planets" />;
        }

        if(is.null(this.props.appState.equippedWeapon)) {
            return (
                <React.Fragment>
                    <p>You can't go into the field without a weapon! Buy one at home base.</p>
                    <UlInline>
                        <li key={"homebase"}><PrimaryButton text="Home base" onClick={this.sendToHomeBase} /></li>
                    </UlInline>
                </React.Fragment>
            );
        }

        return (
            <UlInline>
                <li key={"homebase"}><PrimaryButton text="Home base" onClick={this.sendToHomeBase} /></li>
                {this.props.appState.planets.map((planet) => (
                    <li key={planet.name}><PrimaryButton text={`Fly to ${planet.name}`} onClick={this.sendToPlanet.bind(this, planet.name)} /></li>
                ))}
            </UlInline>
        );
    }

    private sendToHomeBase = (): void => {
        this.props.history.push(routes.HomeBase);
    }

    private sendToPlanet = (name: string): void => {
        this.props.history.push(routes.Planet.replace(":name", name));
    }

    private setLocalPlayerID = (_: any, newValue: string): void => {
        this.setState({
            playerName: newValue,
        });
    }

    private login = (): void => {
        this.props.onPageClearError();

        this.setState({
            isLoggingIn: true,
        });

        PlayFabHelper.LoginWithCustomID(this.props.appState.titleId, this.state.playerName, (player) => {
            this.props.dispatch(actionSetPlayerId(player.PlayFabId));
            this.props.dispatch(actionSetPlayerName(this.state.playerName));

            if(player.NewlyCreated) {
                PlayFabHelper.UpdateUserTitleDisplayName(this.state.playerName, this.props.onPageNothing, this.props.onPageError);
            }

            PlayFabHelper.ExecuteCloudScript(CloudScriptFunctionNames.playerLogin, null, (data) => {
                const response: IPlayerLoginResponse = data.FunctionResult;
                this.props.dispatch(actionSetPlayerHP(response.playerHP));

                this.setState({
                    equipArmor: response.equippedArmor,
                    equipWeapon: response.equippedWeapon,
                });
                
                this.getInventory();
            }, this.props.onPageError);

            PlayFabHelper.GetTitleData([TITLE_DATA_PLANETS, TITLE_DATA_STORES, TITLE_DATA_ENEMIES], (data) => {
                this.props.dispatch(actionSetPlanetsFromTitleData(data, TITLE_DATA_PLANETS));
                this.props.dispatch(actionSetStoreNamesFromTitleData(data, TITLE_DATA_STORES));
                this.props.dispatch(actionSetEnemiesFromTitleData(data, TITLE_DATA_ENEMIES));
            }, this.props.onPageError);
            
            PlayFabHelper.GetCatalogItems(CATALOG_VERSION, (catalog) => {
                this.props.dispatch(actionSetCatalog(catalog));
            }, this.props.onPageError)
            
            this.setState({
                isLoggingIn: false,
            });
        }, this.props.onPageError);
    }

    private getInventory(): void {
        PlayFabHelper.GetUserInventory((inventory) => {
            this.props.dispatch(actionSetInventory(inventory));
        }, this.props.onPageError);
    }

    private isValid(): boolean {
        return this.props.appState.hasTitleId;
    }
}

export const PlayerPage = withAppState(withPage(PlayerPageBase));