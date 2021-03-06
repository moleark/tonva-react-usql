import * as React from 'react';
import {observer} from 'mobx-react';
import {TuidPickFace, FormProps, SearchBox, List} from 'tonva-react-form';
import {nav, Page} from 'tonva-tools';
import {EntityLink} from '../entityLink';
import {EntitiesUI, TuidUI, TuidInputProps, TuidInput, TuidPickPageProps} from '../../ui';
import {Tuid} from '../../entities';
import { POINT_CONVERSION_HYBRID } from 'constants';

export interface TuidInputState {
    id: number;
    proxyId: number;
    proxyName: string;
}

@observer
export class GeneralTuidInput extends React.Component<TuidInputProps, TuidInputState> {
    private id = 0;
    constructor(props) {
        super(props);
        this.onClick = this.onClick.bind(this);
        this.onPicked = this.onPicked.bind(this);
        this.inputOnBlur = this.inputOnBlur.bind(this);
        this.state = {
            id: this.props.id,
            proxyId: undefined,
            proxyName: undefined,
        };
    }
    async componentWillMount() {
        await this.props.ui.entity.loadSchema();
    }
    onPicked(value:any) {
        let {id, prox} = value;
        this.setState(value);
            //id: id,
            //proxyId: number;
            //proxyName: string;
        //})
        let {ui, onIdChanged}  = this.props;
        if (id !== undefined) ui.entity.useId(id);
        onIdChanged({id:id});
    }
    onClick() {
        let {ui} = this.props;
        let id = this.state.id;
        let tuid = ui.entity;
        let proxies = tuid.schema.proxies;
        let {pickPage:PickPage} = ui.input;
        if (PickPage === undefined) PickPage = PickTuidPage;
        if (proxies === undefined) {
            nav.push(<PickPage {...this.props}
                id={id}
                onPicked={this.onPicked} />);
        }
        else {
            nav.push(<SelectTuidPage {...this.props}
                id={id}
                proxies={proxies}
                onPicked={this.onPicked} />);
        }
    }
    inputOnBlur(evt) {
        let value = evt.currentTarget.value;
        let id = Number(value);
        if (id <= 0) {
            evt.currentTarget.value = '';
            return;
        }
        let {onIdChanged}  = this.props;
        this.props.ui.entity.useId(id);
        onIdChanged({id:id});
    }
    render() {
        let {ui, onIdChanged} = this.props;
        let content = this.content(ui.input);
        if (onIdChanged === undefined) {
            return <span>{content}</span>;
        }
        return <button className="form-control btn btn-outline-info"
            type="button"
            style={{textAlign:'left', paddingLeft:'0.75rem'}}
            onClick={this.onClick}>
            {content}
        </button>
    }

    private content(input: TuidInput):JSX.Element {
        let {ui} = this.props;
        let {entity, caption, entitiesUI} = ui;
        let id = this.state.id;
        let content;
        if (id === undefined) {
            let {proxyName, proxyId} = this.state;
            if (proxyId !== undefined) {
                return this.idContent(proxyName, proxyId);
            }
            return <div>点击搜索{caption}</div>;
        }

        let proxies = entity.proxies;
        if (proxies === undefined) {
            let val = entity.getId(id);
            if (typeof val === 'number') {
                return this.idContent(caption, id);
            }
            let InputContent = input.inputContent;
            if (val === undefined)
                return this.idContent(caption, id);
            if (InputContent === undefined)
                return <div>{caption}: {JSON.stringify(val)}</div>;
            return <InputContent value={val} />;
        }

        // ==== proxy tuid =====
        let val = entity.getId(id);
        if (typeof val === 'number')
            return this.idContent(caption, id);

        let {type, $proxy} = val;
        let tuidUI:TuidUI = entitiesUI.tuid.coll[type];
        let InputContent = tuidUI.input.inputContent;
        caption = tuidUI.caption;
        id = $proxy;
        val = tuidUI.entity.getId($proxy);
        if (typeof val === 'number')
            return this.idContent(caption, id);

        if (InputContent === undefined || val === undefined) {
            return this.idContent(caption, id);
        }
        return <InputContent value={val} />;
    }

    private idContent(caption:string, id:number) {
        return <div>{caption}: {id}</div>;
    }
}

interface Proxy {
    tuidName: string;
}
class SelectTuidPage extends React.Component<TuidPickPageProps & {proxies:any}> {
    private proxies:Proxy[];
    private proxy:Proxy;

    constructor(props) {
        super(props);
        this.itemClick = this.itemClick.bind(this);
        this.itemRender = this.itemRender.bind(this);
        this.onPicked = this.onPicked.bind(this);
        this.proxies = [];
        let {proxies} = this.props;
        for (let i in proxies) {
            let p = proxies[i];
            this.proxies.push({
                tuidName: p.name,
            });
        }
    }
    private itemRender(proxy:Proxy, index:number):JSX.Element {
        return <EntityLink ui={this.props.ui.entitiesUI.tuid.coll[proxy.tuidName]} />;
    }
    private itemClick(proxy:Proxy) {
        this.proxy = proxy;
        let {ui} = this.props;
        let proxyTuidUI = ui.entitiesUI.tuid.coll[proxy.tuidName];
        let proxyTuid = proxyTuidUI.entity;
        let {pickPage:PickPage} = ui.input;
        if (PickPage === undefined) PickPage = PickTuidPage;
        nav.pop();
        nav.push(<PickPage {...this.props}
            ui={proxyTuidUI}
            onPicked={this.onPicked} />);
    }
    async onPicked(value:any) {
        let {onPicked, ui}  = this.props;
        let {id} = value;
        let proxy = this.proxy.tuidName;
        onPicked({id: undefined, proxyId: id, proxyName: proxy});
        let proxiedValue = await ui.entity.proxied(proxy, id);
        if (!proxiedValue) {
            console.log("proxiedValue is null");
            return;
        }
        let {id:pid, $proxy, type} = proxiedValue;
        onPicked({id: pid});
    }
    render() {
        let {ui} = this.props;
        return <Page header="选择">
            <List items={this.proxies} item={{render: this.itemRender, onClick: this.itemClick}} />
        </Page>;
    }
}

interface State {
    items: any[];
}
class PickTuidPage extends React.Component<TuidPickPageProps, State> {
    constructor(props) {
        super(props);
        this.onSearch = this.onSearch.bind(this);
        this.renderRow = this.renderRow.bind(this);
        this.rowClick = this.rowClick.bind(this);
        this.state = {
            items: null
        }
    }
    async onSearch(key:string) {
        let result = await this.props.ui.entity.search(key, 0, 30);
        this.setState({
            items: result
        });
    }
    renderRow(item:any, index:number):JSX.Element {
        let {candidateRow:CandidateRow} = this.props.ui.input;
        if (CandidateRow !== undefined) return <CandidateRow item={item} index={index} />;
        return <div className="px-3 py-2">{JSON.stringify(item)}</div>
    }
    rowClick(item:any) {
        this.props.onPicked(item);
        nav.pop();
    }
    render() {
        let {ui} = this.props;
        let header=<SearchBox className="mx-1 w-100" placeholder={ui.caption} onSearch={this.onSearch}  />;
        return <Page header={header}>
            <List 
                className="my-3"
                before={'搜索' + ui.caption}
                items={this.state.items} 
                item={{render: this.renderRow, onClick:this.rowClick}} />
        </Page>;
    }
}
