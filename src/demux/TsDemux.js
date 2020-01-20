/**
 * @copyright: Copyright (C) 2019
 * @desc: ts packet demux
 * @author: liuliguo 
 * @file: TsDemux.js
 */
// import Mux from '../lib/mux.js'
// import Mux from '../lib/demuxer.js'
import Mux from 'demuxer'
import { AV_TIME_BASE_Q }from '../config/Config.js'
class TsDemux {
  previousPes = null
  maxAudioPTS = 0
  maxVideoPTS = 0
  constructor(decode) {
    if (!decode) {
      console.error('class TsDemux need pass decode parmas')
      return
    }
    this.init()
    this.dataArray = []
    this.videoArray = []
    this.audioArray = []
    this.decode = decode
  }
  init() {
    try {
      // this.demuxer = new Mux('m2ts', 'mp4', {
      this.demuxer = new Mux('m2ts', {
        enableWorker: false,
        debug: false,
        onlyDemuxElementary: true
      })
      this.demuxer.on(Mux.Events.DEMUX_DATA, event => {
        if (event instanceof Array) {
          this.dataArray.push(event)
          this.demuxed(this.dataArray)
          this.dataArray = []
        } else {
          this.dataArray.push(event)
        }
      })
    } catch (error) {
      console.error('初始化Mux失败')
    }
  }
  push(data) {
    this.demuxer.push(data, { done: true })
  }
  demuxed(dataArray) {
    dataArray.forEach(data => {
      this.tsDemuxed(data)
    })
  }
  tsDemuxed(data) {
    let streamType = data.stream_type
    let pes = data.pes || {}
    if (data instanceof Array) {
      //one ts demux finished
      this.previousPes.partEnd = true
      //the last ts packet demux finished
      this.previousPes.lastTS = this.isLast

      if (this.isLast) {
        this.maxPTS = Math.min(this.maxAudioPTS, this.maxVideoPTS)
        //the audio has finished
        pes.audioEnd = true
        this.audioQueue(pes)
        self.postMessage({
          type: 'demuxedAAC',
          data: this.audioArray
        })
        this.audioArray = []
        self.postMessage({
          type: 'maxPTS',
          data: {
            maxAudioPTS: this.maxAudioPTS,
            maxVideoPTS: this.maxVideoPTS
          }
        })
      } else {
        self.postMessage({
          type: 'demuxedAAC',
          data: this.audioArray
        })
        this.audioArray = []
      }
      //start decode H265
      this.decode.push(this.videoArray)
      this.videoArray = []
      this.previousPes = null
      return
    }
    switch (streamType) {
      //h265
      case 36:
        this.videoQueue(pes)
        break
      case 3:
      case 15:
      case 17:
        pes.PTS = Math.round(pes.PTS * AV_TIME_BASE_Q * 1000)
        this.maxAudioPTS = Math.max(pes.PTS, this.maxAudioPTS)
        this.audioQueue(pes)
        break
      default:
        break
    }
  }
  audioQueue(pes) {
    this.audioArray.push(pes)
  }
  videoQueue(pes) {
    this.previousPes = pes
    this.maxVideoPTS = Math.max(this.maxVideoPTS, pes.PTS)
    this.videoArray.push(pes)
  }
  destroy() {
    this.demuxer.destroy()
  }
}
export default TsDemux