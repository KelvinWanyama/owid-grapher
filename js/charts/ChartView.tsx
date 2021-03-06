import * as React from 'react'
import * as ReactDOM from 'react-dom'
import { observable, computed, action } from 'mobx'
import { observer } from 'mobx-react'
import { select } from 'd3-selection'
import 'd3-transition'

import ChartConfig, { ChartConfigProps } from './ChartConfig'
import {ControlsFooter, ControlsFooterView} from './ControlsFooter'
import ChartTab from './ChartTab'
import DataTab from './DataTab'
import MapTab from './MapTab'
import SourcesTab from './SourcesTab'
import DownloadTab from './DownloadTab'
import { VNode, throttle, isMobile } from './Util'
import Bounds from './Bounds'
import DataSelector from './DataSelector'

declare const window: any

interface ChartViewProps {
    bounds: Bounds,
    chart: ChartConfig,
    isExport?: boolean,
    isEditor?: boolean,
    isEmbed?: boolean
}

@observer
export default class ChartView extends React.Component<ChartViewProps> {
    static bootstrap({ jsonConfig, containerNode, isEditor, isEmbed, queryStr }: { jsonConfig: ChartConfigProps, containerNode: HTMLElement, isEditor?: boolean, isEmbed?: true, queryStr?: string }) {
        select(containerNode).classed('chart-container', true)
        let chartView
        const chart = new ChartConfig(jsonConfig, { isEmbed: isEmbed, queryStr: queryStr })

        function render() {
            const rect = containerNode.getBoundingClientRect()
            const containerBounds = Bounds.fromRect(rect)

            if (containerBounds.width <= 400)
                chart.baseFontSize = 14
            else if (containerBounds.width < 1080)
                chart.baseFontSize = 16
            else if (containerBounds.width >= 1080)
                chart.baseFontSize = 18
            Bounds.baseFontFamily = "Helvetica, Arial"
            chartView = ReactDOM.render(<ChartView bounds={containerBounds} chart={chart} isEditor={isEditor} isEmbed={isEmbed} />, containerNode)
        }

        render()
        window.addEventListener('resize', throttle(render))
        return chartView
    }

    @computed get chart() { return this.props.chart }

    @computed get isExport() { return !!this.props.isExport }
    @computed get isEditor() { return !!this.props.isEditor }
    @computed get isEmbed() { return this.props.isEmbed || (!this.isExport && (window.self !== window.top || this.isEditor)) }
    @computed get isMobile() { return isMobile() }

    @computed get containerBounds() { return this.props.bounds }

    @computed get isPortrait() { return this.containerBounds.width < this.containerBounds.height }
    @computed get isLandscape() { return !this.isPortrait }

    @computed get authorWidth() { return this.isPortrait ? 400 : 850 }
    @computed get authorHeight() { return this.isPortrait ? 640 : 600 }

    // If the available space is very small, we use all of the space given to us
    @computed get fitBounds(): boolean {
        const { isEditor, isEmbed, isExport, containerBounds, authorWidth, authorHeight } = this

        if (isEditor)
            return false
        else
            return isEmbed || isExport || containerBounds.height < authorHeight || containerBounds.width < authorWidth
    }

    // If we have a big screen to be in, we can define our own aspect ratio and sit in the center
    @computed get paddedWidth(): number { return this.isPortrait ? this.containerBounds.width * 0.9 : this.containerBounds.width * 0.9 }
    @computed get paddedHeight(): number { return this.isPortrait ? this.containerBounds.height * 0.9 : this.containerBounds.height * 0.9 }
    @computed get scaleToFitIdeal(): number {
        return Math.min(this.paddedWidth / this.authorWidth, this.paddedHeight / this.authorHeight)
    }
    @computed get idealWidth(): number { return this.authorWidth * this.scaleToFitIdeal }
    @computed get idealHeight(): number { return this.authorHeight * this.scaleToFitIdeal }

    // These are the final render dimensions
    @computed get renderWidth() { return this.fitBounds ? this.containerBounds.width - (this.isExport ? 0 : 5) : this.idealWidth }
    @computed get renderHeight() { return this.fitBounds ? this.containerBounds.height - (this.isExport ? 0 : 5) : this.idealHeight }

    @computed get controlsFooter(): ControlsFooter {
        const that = this
        return new ControlsFooter({
            get chart() { return that.props.chart },
            get chartView() { return that },
            get width() { return that.renderWidth }
        })
    }

    @computed get svgBounds() {
        return (new Bounds(0, 0, this.renderWidth, this.renderHeight)).padBottom(this.isExport ? 0 : this.controlsFooter.height)
    }

    @computed get svgInnerBounds() {
        return new Bounds(0, 0, this.svgBounds.width, this.svgBounds.height).pad(15)
    }

    @observable popups: VNode[] = []
    @observable.ref isSelectingData: boolean = false

    @observable.ref htmlNode!: HTMLDivElement
    @observable.ref svgNode!: SVGSVGElement
    base!: HTMLDivElement
    hasFadedIn: boolean = false

    @computed get classNames(): string {
        const classNames = [
            "chart",
            this.isExport && "export",
            this.isEditor && "editor",
            this.isEmbed && "embed",
            this.isPortrait && "portrait",
            this.isLandscape && "landscape"
        ]

        return classNames.filter(n => !!n).join(' ')
    }

    addPopup(vnode: VNode) {
        this.popups.push(vnode)
    }

    removePopup(vnodeType: any) {
        this.popups = this.popups.filter(d => !(d.nodeName === vnodeType))
    }

    getChildContext() {
        return {
            chart: this.chart,
            chartView: this,
            baseFontSize: this.chart.baseFontSize,
            isStatic: this.isExport,
            addPopup: this.addPopup.bind(this),
            removePopup: this.removePopup.bind(this)
        }
    }

    renderPrimaryTab(bounds: Bounds): JSX.Element | undefined {
        const { chart } = this
        if (chart.primaryTab === 'chart')
            return <ChartTab bounds={bounds} chartView={this} chart={this.chart} />
        else if (chart.primaryTab === 'map')
            return <MapTab bounds={bounds} chart={this.chart} />
        else
            return undefined
    }

    renderOverlayTab(bounds: Bounds): JSX.Element | undefined {
        const { chart } = this
        if (chart.overlayTab === 'sources')
            return <SourcesTab bounds={bounds} chart={chart} />
        else if (chart.overlayTab === 'data')
            return <DataTab bounds={bounds} chart={chart} />
        else if (chart.overlayTab === 'download')
            return <DownloadTab bounds={bounds} chart={chart} />
        else
            return undefined
    }

    renderSVG() {
        const { chart, svgBounds, svgInnerBounds } = this

        const svgStyle = {
            fontFamily: "'Helvetica Neue', Helvetica, Arial, sans-serif",
            fontSize: chart.baseFontSize,
            backgroundColor: "white",
            "text-rendering": "optimizeLegibility",
            "-webkit-font-smoothing": "antialiased"
        }

        return <svg xmlns="http://www.w3.org/2000/svg" version="1.1" style={svgStyle} width={svgBounds.width} height={svgBounds.height} ref={(e: SVGSVGElement) => this.svgNode = e}>
            {this.renderPrimaryTab(svgInnerBounds)}
        </svg>
    }

    renderReady() {
        const { svgBounds, chart } = this

        return [
            this.renderSVG(),
            <ControlsFooterView controlsFooter={this.controlsFooter} />,
            this.renderOverlayTab(svgBounds),
            this.popups,
            this.chart.tooltip,
            this.isSelectingData && <DataSelector chart={chart} chartView={this} onDismiss={action(() => this.isSelectingData = false)} />
        ]
    }

    render() {
        if (this.isExport) {
            return this.renderSVG()
        } else {
            const { renderWidth, renderHeight } = this

            const style = { width: renderWidth, height: renderHeight, fontSize: this.chart.baseFontSize }

            return this.chart.data.isReady && <div className={this.classNames} style={style}>
                {this.renderReady()}
            </div>
        }
    }

    componentDidMount() {
        this.htmlNode = this.base
        window.chartView = this
    }

    componentDidUpdate() {
        if (this.chart.data.isReady && !this.hasFadedIn) {
            select(this.base).selectAll(".chart > *").style('opacity', 0).transition().style('opacity', null)
            this.hasFadedIn = true
        }
    }
}
