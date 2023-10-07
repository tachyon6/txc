import { Injectable } from '@nestjs/common';
import * as ytdl from 'ytdl-core';
import * as fs from 'fs';
import { InputOfOneVideo, VideoInfos } from './editor.interface';
import * as ffmpeg from 'fluent-ffmpeg';
import { PubSub } from 'graphql-subscriptions';



@Injectable()
export class EditorService {
    constructor() {}

    async processVideo(userInputs: InputOfOneVideo[], fileName: string): Promise<any> {
        try{
            //비디오 정보만 따로 저장(url, videoId, videoTitle, startTime, endTime, videoLength)
            const videoInfos: VideoInfos[] = [];
            var order = 1;
            for(const input of userInputs){
                const { url, startTime, endTime } = input;
                const info = await ytdl.getInfo(url);
                const videoTitle = info.videoDetails.title;
                const videoId = info.videoDetails.videoId;
                const videoLength = parseInt(info.videoDetails.lengthSeconds);
                const startTimeInSecond = timeStampToSeconds(startTime);
                const endTimeInSecond = timeStampToSeconds(endTime);
                videoInfos.push({url, videoId, videoTitle, startTime: startTimeInSecond, endTime: endTimeInSecond, videoLength, order});
                order++;
            }
            console.log(videoInfos);
            //async download
            const downloadPromises = videoInfos.map(async (info) => {
                await this.downloadVideo(info);
                console.log(info.videoTitle, 'downloaded successfully');
            });
            //await all download
            await Promise.all(downloadPromises);

            //async cut: 시작, 끝 시간에 맞춰 자르기
            const cutPromises = videoInfos.map(async (info: VideoInfos) => {
                await this.cutVideo(info);
                console.log(info.videoTitle + ' video cut successfully');
            });
            //await all cut
            await Promise.all(cutPromises);

            //async merge: 잘라진 cutted video를 합치기
            await this.mergeVideos(videoInfos, fileName);

            //원본 영상, cutted 영상 삭제
            await this.deleteVideos(videoInfos, fileName);

            return 'success';
        } catch (err) {
            console.log('processVideo() error')
            throw err;
        }
    }


    async downloadVideo(info: VideoInfos): Promise<any> {
        try{
            const{url, videoId, videoTitle, startTime, endTime} = info;
            const videoStream = await ytdl(url, {
                quality: 'highest',
                filter: 'audioandvideo',
            });
            const outputStream = fs.createWriteStream(`./videos/${videoId}.mp4`);

            return new Promise<void>((resolve, reject) => {
                videoStream.pipe(outputStream);

                outputStream.on('finish', () => {
                    console.log('Video download completed');
                    resolve();
                });

                outputStream.on('error', (err) => {
                    console.log('downloadYTVideo() error', err);
                    reject(err);
                });
            });
        } catch (err) {
            console.log('downloadYTVideo() error')
            throw err;
        }
    }

    async cutVideo(info: VideoInfos): Promise<any> {
        try{
            const pubSub = new PubSub();

            const{url, videoId, videoTitle, startTime, endTime, videoLength, order} = info;
            const duration = endTime - startTime;
            console.log('cutVideo() called');
            return new Promise<void>((resolve, reject) => {
                ffmpeg(`./videos/${videoId}.mp4`)
                    .size('1920x1080')
                    .autopad()
                    .fps(30)
                    .setStartTime(startTime)
                    .setDuration(duration)
                    .output(`./videos/${startTime}-${endTime}-${videoId}_cutted.mp4`)
                    .on('progress', (progress) => {
                        console.log('Processing: ' + Math.floor(progress.percent/(duration/videoLength)) + '% done');
                        pubSub.publish('progress', {progress: Math.floor(progress.percent/(duration/videoLength)), state: order});
                    })
                    .on('end', () => {
                        console.log(videoId + ' video cut completed');
                        resolve();
                    })
                    .on('error', (err) => {
                        console.log('cutVideo() error', err);
                        reject(err);
                    })
                    .run();
            });
        } catch(err){
            throw err;
        }
    }

    async mergeVideos(infos: VideoInfos[], fileName: string): Promise<any> {
        try{
            const pubSub = new PubSub();

            console.log('mergeVideos() called');
            console.log(fileName);
            return new Promise<void>(async (resolve, reject) => {
                const mergedVideo = await ffmpeg();
                //save all audio 
                for (const info of infos) {
                    const { startTime, endTime, videoId } = info;
                    mergedVideo.addInput(`./videos/${startTime}-${endTime}-${videoId}_cutted.mp4`);
                }
                mergedVideo.mergeToFile(`./videos/${fileName}.mp4`)
                    .on('progress', (progress) => {
                        console.log('Processing: ' + Math.floor(progress.percent/2) + '% done');
                        pubSub.publish('progress', {progress: Math.floor(progress.percent/2), state: 'merge'});
                    })
                    .on('end', () => {
                        console.log('mergeVideos() completed');
                        resolve();
                    })
                    .on('error', (err) => {
                        console.log('mergeVideos() error', err);
                        reject(err);
                    });
            });        
        } catch(err){
            throw err;
        }
    }

    //delete file `./videos/${videoId}.mp4`, ${startTime+endTime+videoId}_cutted.mp4`, `./videos/${fileName}.mp4`
    async deleteVideos(videoInfos: VideoInfos[], fileName: string): Promise<any> {
        try{
            const deletePromises = videoInfos.map(async (info: VideoInfos) => {
                const{url, videoId, videoTitle, startTime, endTime} = info;

                fs.unlink(`./videos/${videoId}.mp4`, (err) => {
                    if (err) {
                        console.log('deleteVideos() error', err);
                        throw err;
                    }
                    console.log(`./videos/${videoId}.mp4 was deleted`);
                });

                fs.unlink(`./videos/${startTime}-${endTime}-${videoId}_cutted.mp4`, (err) => {
                    if (err) {
                        console.log('deleteVideos() error', err);
                        throw err;
                    }
                    console.log(`./videos/${startTime}-${endTime}-${videoId}_cutted.mp4 was deleted`);
                });
            });

            await Promise.all(deletePromises);
            
        } catch(err){
            throw err;
        }
    }

    async deleteOutputVideo(fileName: string): Promise<any> {
        try{
            fs.unlink(`./videos/${fileName}.mp4`, (err) => {
                if (err) {
                    console.log('deleteVideos() error', err);
                    throw err;
                }
                console.log(`./videos/${fileName}.mp4 was deleted`);
            });
            return 'output video deleted successfully';
        } catch(err){
            throw err;
        }
    }




    private sharedData: any;

    setSharedData(data: any) {
        this.sharedData = data;
      }
    
      getSharedData() {
        return this.sharedData;
      }

}

function timeStampToSeconds(timestamp) {
    const parts = timestamp.split(':');
    const hours = parseInt(parts[0], 10);
    const minutes = parseInt(parts[1], 10);
    const seconds = parseInt(parts[2], 10);
    return hours * 3600 + minutes * 60 + seconds;
}
