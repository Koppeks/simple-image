/**
 * Build styles
 */
import './index.css';

import { IconAddBorder, IconStretch, IconAddBackground } from '@codexteam/icons';

import type {
  API,
  FilePasteEvent,
  HTMLPasteEvent,
  PasteEvent,
  PatternPasteEvent
} from "@editorjs/editorjs"

/**
 * SimpleImage Tool for the Editor.js
 * Works only with pasted image URLs and requires no server-side uploader.
 *
 * @typedef {object} SimpleImageData
 * @description Tool's input and output data format
 * @property {string} url — image URL
 * @property {string} caption — image caption
 * @property {boolean} withBorder - should image be rendered with border
 * @property {boolean} withBackground - should image be rendered with background
 * @property {boolean} stretched - should image be stretched to full width of container
 */

export interface SimpleImageData {
  //image URL
  url: string;
  //image caption
  caption: string;
  //should image be rendered with border
  withBorder?: boolean;
  //should image be rendered with background
  withBackground?: boolean;
  //should image be stretched to full width of container
  stretched?: boolean;
}

interface SimpleImageParams {
  dataImage: SimpleImageData;
  config:object;
  api: API;
  readOnly: boolean;
}

interface SimpleImageCSS {
    baseClass:string,
    loading: string,
    input:string,
    /**
     * Tool's classes
     */
    wrapper: string,
    imageHolder: string,
    caption: string,
}

export default class SimpleImage {
  /**
   * Render plugin`s main Element and fill it with saved data
   *
   * @param {{dataImage: SimpleImageData, config: object, api: object}}
   *   dataImage — previously saved data
   *   config - user config for Tool
   *   api - Editor.js API
   *   readOnly - read-only mode flag
   */

  /**
   * Create all private the necesary class properties
   */
  private api: API;
  private readOnly: boolean;
  private blockIndex: number;
  private dataImage: SimpleImageData;
  private CSS: SimpleImageCSS
  private nodes: {
    wrapper: HTMLElement | null;
    imageHolder: HTMLElement | null;
    image: HTMLImageElement | null;
    caption: HTMLElement | null;
  }
  private tunes: {
    name: string;
    label: string;
    icon: any;
  }[];

  constructor({ dataImage, config, api, readOnly }:SimpleImageParams) {
    /**
     * Editor.js API
     */
    this.api = api;
    this.readOnly = readOnly;

    /**
     * When block is only constructing,
     * current block points to previous block.
     * So real block index will be +1 after rendering
     *
     * @todo place it at the `rendered` event hook to get real block index without +1;
     * @type {number}
     */
    this.blockIndex = this.api.blocks.getCurrentBlockIndex() + 1;

    /**
     * Styles
     */
    this.CSS = {
      baseClass: this.api.styles.block,
      loading: this.api.styles.loader,
      input: this.api.styles.input,

      /**
       * Tool's classes
       */
      wrapper: 'cdx-simple-image',
      imageHolder: 'cdx-simple-image__picture',
      caption: 'cdx-simple-image__caption',
    };

    /**
     * Nodes cache
     */
    this.nodes = {
      wrapper: null,
      imageHolder: null,
      image: null,
      caption: null,
    };

    /**
     * Tool's initial data
     */
    this.dataImage = {
      url: dataImage.url || '',
      caption: dataImage.caption || '',
      withBorder: dataImage.withBorder !== undefined ? dataImage.withBorder : false,
      withBackground: dataImage.withBackground !== undefined ? dataImage.withBackground : false,
      stretched: dataImage.stretched !== undefined ? dataImage.stretched : false,
    };

    /**
     * Available Image tunes
     */
    this.tunes = [
      {
        name: 'withBorder',
        label: 'Add Border',
        icon: IconAddBorder,
      },
      {
        name: 'stretched',
        label: 'Stretch Image',
        icon: IconStretch,
      },
      {
        name: 'withBackground',
        label: 'Add Background',
        icon: IconAddBackground,
      },
    ];
  }

  /**
   * Creates a Block:
   *  1) Show preloader
   *  2) Start to load an image
   *  3) After loading, append image and caption input
   *
   * @public
   */
  render() {
    /**
     * Specific return as on each of the _make
     */
    const wrapper = this._make('div',[this.CSS.baseClass, this.CSS.wrapper]) as HTMLElement,
        loader = this._make('div', this.CSS.loading) as HTMLElement,
        imageHolder = this._make('div', this.CSS.imageHolder) as HTMLElement,
        image = this._make('img') as HTMLImageElement,
        caption = this._make('div', [this.CSS.input, this.CSS.caption], {
          contentEditable: !this.readOnly,
          innerHTML: this.data.caption || '',
        }) as HTMLElement;

    caption.dataset.placeholder = 'Enter a caption';

    wrapper.appendChild(loader);

    if (this.data.url) {
      image.src = this.data.url;
    }

    image.onload = () => {
      wrapper.classList.remove(this.CSS.loading);
      imageHolder.appendChild(image);
      wrapper.appendChild(imageHolder);
      wrapper.appendChild(caption);
      loader.remove();
      this._acceptTuneView();
    };

    image.onerror = (e) => {
      // @todo use api.Notifies.show() to show error notification
      console.log('Failed to load an image', e);
    };

    this.nodes.imageHolder = imageHolder;
    this.nodes.wrapper = wrapper;
    this.nodes.image = image;
    this.nodes.caption = caption;

    return wrapper;
  }

  /**
   * @public
   * @param {Element} blockContent - Tool's wrapper
   * @returns {SimpleImageData}
   */
  save(blockContent: Element): SimpleImageData {
    const image = blockContent.querySelector('img'),
        caption = blockContent.querySelector('.' + this.CSS.input);

    if (!image) {
      return this.data;
    }

    return Object.assign(this.data, {
      url: image.src,
      caption: caption?.innerHTML || "",
    });
  }

  /**
   * Sanitizer rules
   */
  static get sanitize() {
    return {
      url: {},
      withBorder: {},
      withBackground: {},
      stretched: {},
      caption: {
        br: true,
      },
    };
  }

  /**
   * Notify core that read-only mode is suppoorted
   *
   * @returns {boolean}
   */
  static get isReadOnlySupported(): boolean {
    return true;
  }

  /**
   * Read pasted image and convert it to base64
   *
   * @static
   * @param {File} file
   * @returns {Promise<SimpleImageData>}
   */
  onDropHandler(file: File): Promise<SimpleImageData> {
    const reader = new FileReader();

    reader.readAsDataURL(file);

    return new Promise<SimpleImageData>((resolve) => {
      reader.onload = (event) => {
        const target = event.target;
        if(target && typeof target.result === "string"){
          resolve({
            url: target.result,
            caption: file.name,
          });
        }
      }
    });
  }

  /**
   * On paste callback that is fired from Editor.
   *
   * @param {PasteEvent} event - event with pasted config
   */
  onPaste(event: PasteEvent) {
    switch (event.type) {
      case 'tag': {
        const img = (event as HTMLPasteEvent).detail.data;
        if (img instanceof HTMLImageElement) {
          this.data = {
            url: img.src
          } as SimpleImageData;
        } else {
          console.error("Pasted element is not an image.");
        }
        break;
      }

      case 'pattern': {
        const { data: text } = (event as PatternPasteEvent).detail;

        this.data = {
          url: text
        } as SimpleImageData;
        break;
      }

      case 'file': {
        const { file } = (event as FilePasteEvent).detail;

        this.onDropHandler(file)
          .then(data => {
            this.data = data;
          });

        break;
      }
    }
  }

  /**
   * Returns image data
   *
   * @returns {SimpleImageData}
   */
  get data(): SimpleImageData {
    return this.dataImage;
  }

  /**
   * Set image data and update the view
   *
   * @param {SimpleImageData} data
   */
  set data(data: SimpleImageData) {
    this.dataImage = Object.assign({}, this.data, data);

    if (this.nodes.image) {
      this.nodes.image.src = this.data.url;
    }

    if (this.nodes.caption) {
      this.nodes.caption.innerHTML = this.data.caption;
    }
  }

  /**
   * Specify paste substitutes
   *
   * @see {@link ../../../docs/tools.md#paste-handling}
   * @public
   */
  static get pasteConfig() {
    return {
      patterns: {
        image: /https?:\/\/\S+\.(gif|jpe?g|tiff|png|webp)$/i,
      },
      tags: [
        {
          img: { src: true },
        },
      ],
      files: {
        mimeTypes: [ 'image/*' ],
      },
    };
  }

  /**
   * Returns image tunes config
   *
   * @returns {Array}
   */
  renderSettings() {
    return this.tunes.map(tune => ({
      ...tune,
      label: this.api.i18n.t(tune.label),
      toggle: true,
      onActivate: () => this._toggleTune(tune.name),
      isActive: !!this.data[tune.name],
    }))
  };

  /**
   * Helper for making Elements with attributes
   *
   * @param  {string} tagName           - new Element tag name
   * @param  {Array|string} classNames  - list or name of CSS classname(s)
   * @param  {object} attributes        - any attributes
   * @returns {Element}
   */


  _make(tagName: string, classNames?: string[] | string, attributes: object = {}): HTMLElement | HTMLImageElement{
    const el = document.createElement(tagName);

    if (Array.isArray(classNames)) {
      el.classList.add(...classNames);
    } else if (classNames) {
      el.classList.add(classNames);
    }

    for (const attrName in attributes) {
      el[attrName] = attributes[attrName];
    }
    return el
  }

  /**
   * Click on the Settings Button
   *
   * @private
   * @param tune
   */
  _toggleTune(tune) {
    this.data[tune] = !this.data[tune];
    this._acceptTuneView();
  }

  /**
   * Add specified class corresponds with activated tunes
   *
   * @private
   */
  _acceptTuneView() {
    this.tunes.forEach(tune => {
      this.nodes.imageHolder.classList.toggle(this.CSS.imageHolder + '--' + tune.name.replace(/([A-Z])/g, (g) => `-${g[0].toLowerCase()}`), !!this.data[tune.name]);

      if (tune.name === 'stretched') {
        this.api.blocks.stretchBlock(this.blockIndex, !!this.data.stretched);
      }
    });
  }
}
