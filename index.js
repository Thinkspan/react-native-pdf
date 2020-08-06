/**
 * Copyright (c) 2017-present, Wonday (@wonday.org)
 * All rights reserved.
 *
 * This source code is licensed under the MIT-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

'use strict';
import React, {Component} from 'react';
import PropTypes from 'prop-types';
import {
    requireNativeComponent,
    View,
    Platform,
    ViewPropTypes,
    StyleSheet,
    Image
} from 'react-native';

import PdfView from './PdfView';

export default class Pdf extends Component {

    static propTypes = {
        ...ViewPropTypes,
        source: PropTypes.oneOfType([
            PropTypes.shape({
                uri: PropTypes.string,
                cache: PropTypes.bool,
                expiration: PropTypes.number,
            }),
            // Opaque type returned by require('./test.pdf')
            PropTypes.number,
        ]).isRequired,
        page: PropTypes.number,
        scale: PropTypes.number,
        minScale: PropTypes.number,
        maxScale: PropTypes.number,
        horizontal: PropTypes.bool,
        spacing: PropTypes.number,
        password: PropTypes.string,
        enableAntialiasing: PropTypes.bool,
        enableAnnotationRendering: PropTypes.bool,
        enablePaging: PropTypes.bool,
        enableRTL: PropTypes.bool,
        fitPolicy: PropTypes.number,
        trustAllCerts: PropTypes.bool,
        singlePage: PropTypes.bool,
        onLoadComplete: PropTypes.func,
        onPageChanged: PropTypes.func,
        onError: PropTypes.func,
        onPageSingleTap: PropTypes.func,
        onScaleChanged: PropTypes.func,
        onPressLink: PropTypes.func,

        // Props that are not available in the earlier react native version, added to prevent crashed on android
        accessibilityLabel: PropTypes.string,
        importantForAccessibility: PropTypes.string,
        renderToHardwareTextureAndroid: PropTypes.string,
        testID: PropTypes.string,
        onLayout: PropTypes.bool,
        accessibilityLiveRegion: PropTypes.string,
        accessibilityComponentType: PropTypes.string,
    };

    static defaultProps = {
        password: "",
        scale: 1,
        minScale: 1,
        maxScale: 3,
        spacing: 10,
        fitPolicy: 2, //fit both
        horizontal: false,
        page: 1,
        enableAntialiasing: true,
        enableAnnotationRendering: true,
        enablePaging: false,
        enableRTL: false,
        trustAllCerts: true,
        usePDFKit: true,
        singlePage: false,
        onLoadComplete: (numberOfPages, path) => {
        },
        onPageChanged: (page, numberOfPages) => {
        },
        onError: (error) => {
        },
        onPageSingleTap: (page, x, y) => {
        },
        onScaleChanged: (scale) => {
        },
        onPressLink: (url) => {
        },
    };

    constructor(props) {

        super(props);
        this.state = {
            path: '',
            isSupportPDFKit: -1
        };
    }

    componentDidUpdate(prevProps) {

        const nextSource = Image.resolveAssetSource(this.props.source);
        const curSource = Image.resolveAssetSource(prevProps.source);

        if ((nextSource.uri !== curSource.uri)) {
            this._loadFromSource(this.props.source);
        }
    }

    componentDidMount() {
        this._mounted = true;
        if (Platform.OS === "ios") {
            const PdfViewManagerNative = require('react-native').NativeModules.PdfViewManager;
            PdfViewManagerNative.supportPDFKit((isSupportPDFKit) => {
                if (this._mounted) {
                    this.setState({isSupportPDFKit: isSupportPDFKit ? 1 : 0});
                }
            });
        }
        this._loadFromSource(this.props.source);
    }

    componentWillUnmount() {
        this._mounted = false;
    }

    _loadFromSource = (newSource) => {

        const source = Image.resolveAssetSource(newSource) || {};

        // first set to initial state
        if (this._mounted) {
            this.setState({path: ''});
        }

        this._prepareFile(source);
    };

    _prepareFile = async (source) => {

        if (!source.uri) {
            this._onError(new Error('no pdf source!'));
            return;
        }

        let uri = source.uri || '';

        const isNetwork = !!(uri && uri.match(/^https?:\/\//));
        const isAsset = !!(uri && uri.match(/^bundle-assets:\/\//));
        const isBase64 = !!(uri && uri.match(/^data:application\/pdf;base64/));

        if (isNetwork || isAsset || isBase64) {
            const error = new Error('http, assets, or base64 sources not supported');
            this._onError(error);
            throw error;
        }

        this.setState({
            path: uri.replace(/file:\/\//i, ''),
        });
    };

    setNativeProps = nativeProps => {
        if (this._root){
            this._root.setNativeProps(nativeProps);
        }
    };

    setPage( pageNumber ) {
        if ( (pageNumber === null) || (isNaN(pageNumber)) ) {
            throw new Error('Specified pageNumber is not a number');
        }
        this.setNativeProps({
            page: pageNumber
        });
    }

    _onChange = (event) => {

        let message = event.nativeEvent.message.split('|');
        //__DEV__ && console.log("onChange: " + message);
        if (message.length > 0) {
            if (message.length > 5) {
                message[4] = message.splice(4).join('|');
            }
            if (message[0] === 'loadComplete') {
                this.props.onLoadComplete && this.props.onLoadComplete(Number(message[1]), this.state.path, {
                    width: Number(message[2]),
                    height: Number(message[3]),
                },
                message[4]&&JSON.parse(message[4]));
            } else if (message[0] === 'pageChanged') {
                this.props.onPageChanged && this.props.onPageChanged(Number(message[1]), Number(message[2]));
            } else if (message[0] === 'error') {
                this._onError(new Error(message[1]));
            } else if (message[0] === 'pageSingleTap') {
                this.props.onPageSingleTap && this.props.onPageSingleTap(Number(message[1]), Number(message[2]), Number(message[3]));
            } else if (message[0] === 'scaleChanged') {
                this.props.onScaleChanged && this.props.onScaleChanged(Number(message[1]));
            } else if (message[0] === 'linkPressed') {
                this.props.onPressLink && this.props.onPressLink(message[1]);
            }
        }

    };

    _onError = (error) => {

        this.props.onError && this.props.onError(error);

    };

    render() {
        if (!this.state.path) {
            return null
        }
        if (Platform.OS === "android" || Platform.OS === "ios") {
                return (
                    <View style={[this.props.style,{overflow: 'hidden'}]}>
                        {
                            Platform.OS === "android"?(
                                    <PdfCustom
                                        ref={component => (this._root = component)}
                                        {...this.props}
                                        style={[{flex:1,backgroundColor: '#EEE'}, this.props.style]}
                                        path={this.state.path}
                                        onChange={this._onChange}
                                    />
                                ):(
                                    this.props.usePDFKit && this.state.isSupportPDFKit === 1?(
                                            <PdfCustom
                                                ref={component => (this._root = component)}
                                                {...this.props}
                                                style={[{backgroundColor: '#EEE',overflow: 'hidden'}, this.props.style]}
                                                path={this.state.path}
                                                onChange={this._onChange}
                                            />
                                        ):(<PdfView
                                            {...this.props}
                                            style={[{backgroundColor: '#EEE',overflow: 'hidden'}, this.props.style]}
                                            path={this.state.path}
                                            onLoadComplete={this.props.onLoadComplete}
                                            onPageChanged={this.props.onPageChanged}
                                            onError={this._onError}
                                            onPageSingleTap={this.props.onPageSingleTap}
                                            onScaleChanged={this.props.onScaleChanged}
                                            onPressLink={this.props.onPressLink}
                                        />)
                                )
                        }
                    </View>);
        } else {
            return (null);
        }


    }
}


if (Platform.OS === "android") {
    var PdfCustom = requireNativeComponent('RCTPdf', Pdf, {
        nativeOnly: {path: true, onChange: true},
    })
} else if (Platform.OS === "ios") {
    var PdfCustom = requireNativeComponent('RCTPdfView', Pdf, {
        nativeOnly: {path: true, onChange: true},
    })
}
