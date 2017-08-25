/* ChartEditor.ts
 * ================
 *
 * Mobx store that represents the current editor state and governs non-UI-related operations.
 *
 */

import {observable, computed, reaction} from 'mobx'
import ChartConfig from '../charts/ChartConfig'
import ChartType from '../charts/ChartType'
import EditorVariable from './EditorVariable'
import EditorFeatures from './EditorFeatures'
import Admin from './Admin'
import * as _ from 'lodash'
import * as $ from 'jquery'

// Contextual information received from server about what is in the database
export interface EditorData {
	namespaces: string[],
	variables: EditorVariable[]
}

export interface ChartEditorProps {
    chart: ChartConfig,
	data: EditorData
}

export type EditorTab = string

export default class ChartEditor {
    @observable.ref chart: ChartConfig
	@observable.ref data: EditorData

    // Whether the current chart state is saved or not
    @observable.ref isSaved: boolean = true
	@observable.ref currentRequest: Promise<any>|undefined

	@observable.ref tab: EditorTab = 'basic'

	@computed get availableTabs(): EditorTab[] {
		const tabs: EditorTab[] = ['basic', 'data', 'customize']
		if (this.chart.hasMapTab) tabs.push('map')
		if (this.chart.type == ChartType.ScatterPlot) tabs.push('scatter')
		return tabs
	}

	@computed get isNewChart() {
		return this.chart.id === undefined
	}

	@computed get variablesById() {
		return _.keyBy(this.data.variables, v => v.id)
	}

	@computed get features() {
		return new EditorFeatures(this)
	}

	load<T>(promise: Promise<T>) {
		this.currentRequest = promise
		promise.then(() => this.currentRequest = undefined).catch(() => this.currentRequest = undefined)
		return promise
	}

	async saveChart({ onError }: { onError?: () => void } = {}) {
		const {chart, isNewChart} = this

		const targetUrl = isNewChart ? "/admin/charts" : `/admin/charts/${chart.id}`


		const handleError = (err: string) => {
			var $modal = modal({ title: "Error saving chart", content: _.toString(err) });
			$modal.addClass("error");
			if (onError) onError()
		}

		try {
			const response = await this.load(Admin.request(targetUrl, chart.json, isNewChart ? 'POST' : 'PUT'))
			if (!response.ok)
				return handleError(await response.text())

			const json = await response.json()

			if (isNewChart) {
				window.location.assign(Admin.url(`/admin/charts/${json.data.id}`))
			} else {
				this.isSaved = true
			}
		} catch (err) {
			handleError(err)
		}
	}

    async saveAsNewChart() {
		const {chart} = this

		const json = chart.json
		delete json.id
		delete json.published

		// Need to open intermediary tab before AJAX to avoid popup blockers
		var w = window.open("/", "_blank");

		const handleError = (err: string) => {
			w.close()
			var $modal = modal({ title: "Error saving chart", content: _.toString(err) });
			$modal.addClass("error");
		}

		try {
			const response = await this.load(Admin.request("/admin/charts", chart.json, 'POST'))
			if (!response.ok)
				return handleError(await response.text())

			const json = await response.json()

			w.location.assign(Admin.url(`/admin/charts/${json.data.id}/edit`))
		} catch (err) {
			handleError(err)
		}
    }

	publishChart() {
		const url = this.chart.url.canonicalUrl

		var $modal = modal();
		$modal.find(".modal-title").html("Publish chart");
		$modal.find(".modal-body").html(
			'<p>This chart will be available at:</p>' +
			'<p><a href="' + url + '" target="_blank">' + url + '</a></p>' +
			'<p>Proceed?</p>'
		);
		$modal.find(".modal-footer").html(
			'<button class="btn btn-danger">Publish chart</button>' +
			'<button class="btn btn-cancel" data-dismiss="modal">Cancel</button>'
		);

		$modal.find(".btn-danger").on("click", () => {
			$modal.modal('hide');

			this.chart.props.isPublished = true
			this.saveChart({ onError: () => this.chart.props.isPublished = undefined })
		})
	}

	unpublishChart() {
		if (window.confirm("Really unpublish chart?")) {
			this.chart.props.isPublished = undefined
			this.saveChart({ onError: () => this.chart.props.isPublished = true })
		}
	}

    constructor(props: ChartEditorProps) {
		const {chart, data} = props
        this.chart = chart
		this.data = data

		reaction(
			() => chart.json,
			() => this.isSaved = false
		)
    }
}

// XXX this is old stuff
function modal(options?: any) {
	options = _.extend({}, options);
	$(".owidModal").remove();

	var html = '<div class="modal owidModal fade" role="dialog">' +
					'<div class="modal-dialog modal-lg">' +
						'<div class="modal-content">' +
							'<div class="modal-header">' +
								'<button type="button" class="close" data-dismiss="modal" aria-label="Close">' +
									'<span aria-hidden="true">&times;</span>' +
								'</button>' +
								'<h4 class="modal-title"></h4>' +
							'</div>' +
							'<div class="modal-body">' +
							'</div>' +
							'<div class="modal-footer">' +
							'</div>' +
						'</div>' +
					'</div>' +
				'</div>';

	$("body").prepend(html);
	var $modal = $(".owidModal") as any;
	$modal.find(".modal-title").html(options.title);
	$modal.find(".modal-body").html(options.content);
	$modal.modal("show");
	return $modal;
};