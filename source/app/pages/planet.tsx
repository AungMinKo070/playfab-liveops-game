import React from "react";
import { RouteComponentProps, Redirect } from "react-router";
import { PrimaryButton } from "office-ui-fabric-react";

import { is } from "../shared/is";
import { PlayFabHelper } from "../shared/playfab";
import { IPlanetData } from "../shared/types";
import { routes } from "../routes";
import { Page } from "../components/page";
import { UlInline } from "../styles";
import { IWithAppStateProps, withAppState } from "../containers/with-app-state";
import { actionSetInventory, actionSetPlayerXP, actionSetPlayerLevel, actionSetPlayerHP } from "../store/actions";
import { IWithPageProps, withPage } from "../containers/with-page";
import { utilities } from "../shared/utilities";
import { Combat } from "../components/combat";
import { IKilledEnemyGroupRequest } from "../../cloud-script/main";
import { CloudScriptHelper } from "../shared/cloud-script";
import { BackLink } from "../components/back-link";

interface IState {
    areaName: string;
    enemyGroupName: string;
    itemsGranted: string[];
    newLevel: number;
    newXP: number;
}

interface IPlanetPageRouteProps {
    name: string;
}

type Props = RouteComponentProps<IPlanetPageRouteProps> & IWithAppStateProps & IWithPageProps;

class PlanetPageBase extends React.Component<Props, IState> {
    constructor(props: Props) {
        super(props);

        this.state = {
            areaName: null,
            enemyGroupName: null,
            itemsGranted: null,
            newLevel: null,
            newXP: null,
        }
    }

    public render(): React.ReactNode {
        if(!this.props.appState.hasTitleId) {
            return null;
        }
        
        if(!this.props.appState.hasPlayerId) {
            return (<Redirect to={routes.MainMenu(this.props.appState.titleId)} />);
        }

        return (
            <Page
                {...this.props}
                title={this.getPageTitle()}
                shouldShowPlayerInfo
            >
                {this.renderPlanet()}
            </Page>
        );
    }

    private renderPlanet(): React.ReactNode {
        const planet = this.getPlanetData();

        if(is.null(this.state.areaName)) {
            return (
                <React.Fragment>
                    <BackLink to={routes.Guide(this.props.appState.titleId)} label="Back to guide" />
                    <h2>Welcome to {planet.name}</h2>
                    <p>Choose a region to fight in:</p>
                    <UlInline>
                        {planet.areas.map((area) => (
                            <li key={area.name}><PrimaryButton text={area.name} onClick={this.setArea.bind(this, area.name)} /></li>
                        ))}
                    </UlInline>
                </React.Fragment>
            );
        }

        return (
            <React.Fragment>
                <h2>Combat</h2>
                <BackLink to={routes.Guide(this.props.appState.titleId)} label="Back to guide" />
                {this.renderItemGranted()}
                {this.renderCombat()}
            </React.Fragment>
        );
    }

    private renderItemGranted(): React.ReactNode {
        if(is.null(this.state.itemsGranted)) {
            return null;
        }

        return (
            <React.Fragment>
                <p>Good job in combat!</p>
                {!is.null(this.state.newXP) && (
                    <p>You gained {this.state.newXP} XP.</p>
                )}
                {!is.null(this.state.newLevel) && (
                    <p>Congratulations! You are now level {this.state.newLevel}!</p>
                )}
                <p>Rewards:</p>
                <ul>
                    {this.state.itemsGranted.map((itemId, index) => (
                        <li key={index}>{this.props.appState.catalog.find(i => i.ItemId === itemId).DisplayName}</li>
                    ))}
                </ul>
                
            </React.Fragment>
            
        )
    }

    private renderCombat(): React.ReactNode {
        const enemyGroup = this.props.appState.enemies.enemyGroups.find(g => g.name === this.state.enemyGroupName);
        const enemyData = enemyGroup.enemies.map(e => this.props.appState.enemies.enemies.find(d => d.name === e));

        return (
            <Combat
                planet={this.getPlanetName()}
                area={this.state.areaName}
                enemyGroup={enemyGroup}
                enemies={enemyData}
                onCombatOver={this.onCombatFinished}
                onLeaveCombat={this.onLeaveCombat}
            />
        );
    }

    private onCombatFinished = (): void => {
        // I'm going to assume that if you're alive, you won
        if(this.props.appState.playerHP === 0) {
            return;
        }

        const combatReport: IKilledEnemyGroupRequest = {
            area: this.state.areaName,
            enemyGroup: this.state.enemyGroupName,
            planet: this.getPlanetName(),
            playerHP: this.props.appState.playerHP,
        };

        CloudScriptHelper.killedEnemyGroup(combatReport, (response) => {
            if(!is.null(response.errorMessage)) {
                this.props.onPageError(`Error when finishing combat: ${response.errorMessage}`);
                return;
            }

            if(!is.null(response.hp)) {
                // Your HP might be filled when you level up
                this.props.dispatch(actionSetPlayerHP(response.hp));
            }

            if(!is.null(response.itemsGranted)) {
                this.setState({
                    itemsGranted: response.itemsGranted
                });

                this.refreshInventory();
            }

            if(!is.null(response.xp)) {
                this.setState({
                    newXP: response.xp - this.props.appState.playerXP
                });

                this.props.dispatch(actionSetPlayerXP(response.xp));
            }
            else {
                this.setState({
                    newXP: null,
                });
            }

            if(!is.null(response.level)) {
                this.props.dispatch(actionSetPlayerLevel(response.level));
                this.setState({
                    newLevel: response.level,
                });
            }
            else {
                this.setState({
                    newLevel: null,
                });
            }
        }, this.props.onPageError);
    }

    private onLeaveCombat = (): void => {
        this.setArea(null);
    }

    private refreshInventory(): void {
        PlayFabHelper.GetUserInventory(data => this.props.dispatch(actionSetInventory(data)), this.props.onPageError);
    }

    private setArea = (area: string): void => {
        if(is.null(area)) {
            this.setState({
                areaName: null,
                enemyGroupName: null,
                itemsGranted: null,
            });

            return;
        }

        // Pick an enemy group to fight
        const thisArea = this.props.appState.planets
            .find(p => p.name === this.getPlanetName())
            .areas
            .find(a => a.name === area);

        if(is.null(thisArea)) {
            return this.props.onPageError(`Area ${area} not found somehow`);
        }

        const enemyGroupIndex = utilities.getRandomInteger(0, thisArea.enemyGroups.length - 1);

        this.setState({
            areaName: area,
            enemyGroupName: thisArea.enemyGroups[enemyGroupIndex],
            itemsGranted: null,
        });
    }

    private getPlanetData(): IPlanetData {
        const planetName = this.getPlanetName();

        return this.props.appState.planets.find(p => p.name === planetName);
    }

    private getPlanetName(): string {
        return this.props.match.params.name;
    }

    private getPageTitle(): string {
        if(!is.null(this.state.areaName)) {
            return `${this.state.areaName} Region`;
        }

        return this.getPlanetName();
    }
}

export const PlanetPage = withAppState(withPage(PlanetPageBase));