let imgElement = document.getElementById('imageSrc');

let int = self.setInterval("clock()",100);
let start_flag = false;
let time = 0;
let imageCnt = 0;
let fileName = null;
let process_flag = true;

let right_flag = false;
let left_flag = false;
// Split the lines into right and left lines
let img_center = null;

// let contours = null;
let right_a = 0;
let right_b = 0;
let left_a = 0;
let left_b = 0;

// clock
function clock()
{
  time++;
  if((start_flag === true) && (time > 10)) {
    // imageProcess();
    displayImage();
    // start_flag = false;
    clearInterval(int);
  } 

}

function displayImage() {
  //let cap = cv.VideoCapture("../video/project_video.mp4") ;
  imageCnt++;
  
  if(imageCnt < 10) {
    fileName = "../img/00" + imageCnt + "_srcImage.jpg";
  } else if(imageCnt >=10 && imageCnt < 100) {
    fileName = "../img/0" + imageCnt + "_srcImage.jpg";
  } else {
    fileName = "../img/" + imageCnt + "_srcImage.jpg";
  }
  
  imgElement.setAttribute("src", fileName);
}

function imageOnload() {
  imageProcess();
  displayImage();
  //setTimeout(function() { displayImage(); }, 50);
}

// image process  
function imageProcess() {

  let startTime = performance.now();
  let mat = cv.imread(imgElement);

  let output = deNoise(mat);
  output = edgeDetector(output);

  output = mask(output);
  let lines = houghLines(output);

  if(lines.rows > 0) {
    let lines_out = lineSeparation(lines, output);
    // Apply regression to obtain only one line for each side of the lane
    let lanes = regression(lines_out, output);
    let turn = predictTurn();
    let endTime = performance.now();
    plotLane(mat, lanes, turn + " Time: "+(endTime - startTime) +" ms ");
  }
 
  if(imageCnt >= 540) {
    imageCnt = 0;
    start_flag = false;
    //clearInterval(int);
  }
  output.delete();
  mat.delete();
}


function ChangeButton() {
  imageProcess();
}


// IMAGE BLURRING
/**
 *@brief Apply gaussian filter to the input image to denoise it
 *@param inputImage is the frame of a video in which the
 *@param lane is going to be detected
 *@return Blurred and denoised image
 */
function deNoise(inputImage) {
    let output = new cv.Mat();
    let kSize = new cv.Size(3, 3);
    cv.GaussianBlur(inputImage, output, kSize, 0, 0);

    delete kSize;

    return output;
}

// EDGE DETECTION
/**
 *@brief Detect all the edges in the blurred frame by filtering the image
 *@param img_noise is the previously blurred frame
 *@return Binary image with only the edges represented in white
 */
function edgeDetector(img_noise) {
  
  let output = new cv.Mat();
  // Convert image from RGB to gray
  cv.cvtColor(img_noise, output, cv.COLOR_RGB2GRAY);
  
  // Binarize gray image
  cv.threshold(output, output, 140, 255, cv.THRESH_BINARY);
  
  let dst = new cv.Mat();

  cv.Canny(output, dst, 50, 150, 3, false);

  output.delete();
  img_noise.delete();

  return dst;
}

// MASK THE EDGE IMAGE
/**
 *@brief Mask the image so that only the edges that form part of the lane are detected
 *@param img_edges is the edges image from the previous function
 *@return Binary image with only the desired edges being represented
 */
function mask(img_edges) {
  let output = new cv.Mat();
  let mask_image = cv.Mat.zeros(img_edges.size(), img_edges.type());

  let npts = 4;
  let square_point_data = new Uint32Array([
      210/2, 720/2,
      550/2, 450/2,
      717/2, 450/2,
      1280/2, 720/2]);
  let square_points = cv.matFromArray(npts, 1, cv.CV_32SC2, square_point_data);
  let pts = new cv.MatVector();
  pts.push_back (square_points);
  let color = new cv.Scalar (255);
  
  // Create a binary polygon mask
  cv.fillConvexPoly(mask_image, square_points, color);
  
  // Multiply the edges image and the mask to get the output
  cv.bitwise_and(img_edges, mask_image, output);
  
  img_edges.delete();
  mask_image.delete();
  pts.delete();
  square_points.delete();
  
  return output;
}

// HOUGH LINES
/**
 *@brief Obtain all the line segments in the masked images which are going to be part of the lane boundaries
 *@param img_mask is the masked binary image from the previous function
 *@return Vector that contains all the detected lines in the image
 */
function houghLines(img_mask) {
  let lines = new cv.Mat();
  let color = new cv.Scalar(255, 0, 0);

  let src = img_mask;
  let dst = cv.Mat.zeros(src.rows, src.cols, cv.CV_8UC3);

  cv.HoughLinesP(src, lines, 1, Math.PI / 180, 20, 20, 30);
  // draw lines
  for (let i = 0; i < lines.rows; ++i) {
      let startPoint = new cv.Point(lines.data32S[i * 4], lines.data32S[i * 4 + 1]);
      let endPoint = new cv.Point(lines.data32S[i * 4 + 2], lines.data32S[i * 4 + 3]);
      cv.line(dst, startPoint, endPoint, color);

      delete startPoint;
  }
  // cv.imshow('edge', dst);
  // color.delete();
  // src.delete();
  dst.delete();
  // img_mask.delete();
  return lines;

}

function onOpenCvReady() {
  document.getElementById('status').innerHTML = 'OpenCV.js is ready.';
  start_flag = true;
}


// SORT RIGHT AND LEFT LINES
/**
 *@brief Sort all the detected Hough lines by slope.
 *@brief The lines are classified into right or left depending
 *@brief on the sign of their slope and their approximate location
 *@param lines is the vector that contains all the detected lines
 *@param img_edges is used for determining the image center
 *@return The output is a vector(2) that contains all the classified lines
 */
function lineSeparation(lines, img_edges) {

  let right_lines = [];
  let left_lines = [];
  let slope_thresh = 0.3;
  let slopes = [];
  let selected_lines = [];

  let ini = null;
  let fini = null;
  // draw lines
  for (let i = 0; i < lines.rows; ++i) {
    ini = new cv.Point(lines.data32S[i * 4], lines.data32S[i * 4 + 1]);
    fini = new cv.Point(lines.data32S[i * 4 + 2], lines.data32S[i * 4 + 3]);
    
    
    // Basic algebra: slope = (y1 - y0)/(x1 - x0)
    let slope = (fini.y - ini.y)/((fini.x - ini.x) + 0.00001);
    
    // If the slope is too horizontal, discard the line
    // If not, save them  and their respective slope
    if (Math.abs(slope) > slope_thresh) {
      slopes.push(slope);
      let a = [ini, fini];
      selected_lines.push(a);
    }
    // cv.line(dst, startPoint, endPoint, color);
  }

  // Split the lines into right and left lines
  img_center = img_edges.cols / 2.0;
  let j = 0;
  // console.log(selected_lines.length);
  while (j < selected_lines.length) {
    ini = selected_lines[j][0];
    fini = selected_lines[j][1];
    // Condition to classify line as left side or right side
    if (slopes[j] > 0 && fini.x > img_center && ini.x > img_center) {
      right_lines.push(selected_lines[j]);
      right_flag = true;
    } else if (slopes[j] < 0 && fini.x < img_center && ini.x < img_center) {
      left_lines.push(selected_lines[j]);
      left_flag = true;
    }
    j++;
  }

  // output[0] = right_lines;
  // output[1] = left_lines;
  let output = [right_lines, left_lines];
  
  return output;
}

// REGRESSION FOR LEFT AND RIGHT LINES
/**
 *@brief Regression takes all the classified line segments initial and final points and fits a new lines out of them using the method of least squares.
 *@brief This is done for both sides, left and right.
 *@param left_right_lines is the output of the lineSeparation function
 *@param inputImage is used to select where do the lines will end
 *@return output contains the initial and final points of both lane boundary lines
 */
function regression(left_right_lines, inputImage) {

  //let src = inputImage;//cv.imread('canvasInput');
  //let dst = cv.Mat.zeros(src.rows, src.cols, cv.CV_8UC3);

  if (right_flag == true) {
    let contours = new cv.MatVector();
    for (let i = 0; i < left_right_lines[0].length; i++) {
      ini = left_right_lines[0][i][0];
      fini = left_right_lines[0][i][1];
      let square_point_data = new Float32Array([
        ini.x, ini.y,
        fini.x, fini.y]);
      let square_points = cv.matFromArray(2, 1, cv.CV_32FC2, square_point_data);
      // let pt = cv.Point(ini.x, ini.y);
      contours.push_back(square_points);
    }
  
    if(left_right_lines[0].length > 0) {
      let line = new cv.Mat();
      let cnt = contours.get(0);
      // You can try more different parameters
      cv.fitLine(cnt, line, cv.DIST_L2, 0, 0.01, 0.01);
      right_a = line.data32F[1] / line.data32F[0];
      right_b = new cv.Point(line.data32F[2], line.data32F[3]);

      line.delete();
      cnt.delete();
    }
    contours.delete();
  }

  if (left_flag == true) {
    let contours = new cv.MatVector();
    for (let i = 0; i < left_right_lines[1].length; i++) {
      ini = left_right_lines[1][i][0];
      fini = left_right_lines[1][i][1];
      
      let square_point_data = new Float32Array([
        ini.x, ini.y,
        fini.x, fini.y]);
      let square_points = cv.matFromArray(2, 1, cv.CV_32FC2, square_point_data);
      // let pt = cv.Point(ini.x, ini.y);

      contours.push_back(square_points);
    }
  
    if(left_right_lines[1].length > 0) {
      let line = new cv.Mat();
      let cnt = contours.get(0);
      // You can try more different parameters
      cv.fitLine(cnt, line, cv.DIST_L2, 0, 0.01, 0.01);
      left_a = line.data32F[1] / line.data32F[0];
      left_b = new  cv.Point(line.data32F[2], line.data32F[3]);
      
      line.delete();
      cnt.delete();
    }
    contours.delete();
  
  }

    // One the slope and offset points have been obtained, apply the line equation to obtain the line points
    let ini_y = inputImage.rows;
    let fin_y = 470/2;
  
    let right_ini_x = ((ini_y - right_b.y) / right_a) + right_b.x;
    let right_fin_x = ((fin_y - right_b.y) / right_a) + right_b.x;
  
    let left_ini_x = ((ini_y - left_b.y) / left_a) + left_b.x;
    let left_fin_x = ((fin_y - left_b.y) / left_a) + left_b.x;
  
    let output = [];
    output.push(new cv.Point(right_ini_x, ini_y));
    output.push(new cv.Point(right_fin_x, fin_y));
    output.push(new cv.Point(left_ini_x, ini_y));
    output.push(new cv.Point(left_fin_x, fin_y));
  
    // src.delete();
    // dst.delete();
    // line.delete();
    return output;
}

// TURN PREDICTION
/**
 *@brief Predict if the lane is turning left, right or if it is going straight
 *@brief It is done by seeing where the vanishing point is with respect to the center of the image
 *@return String that says if there is left or right turn or if the road is straight
 */
function predictTurn() {
  let output = null;
  let vanish_x;
  let thr_vp = 10;

  // The vanishing point is the point where both lane boundary lines intersect
  vanish_x = ((right_a * right_b.x) - (left_a * left_b.x) - right_b.y + left_b.y) / (right_a - left_a);

  // The vanishing points location determines where is the road turning
  if (vanish_x < (img_center - thr_vp)) {
    output = "Left Turn";
  }
  else if (vanish_x > (img_center + thr_vp)) {
    output = "Right Turn";
  }
  else if (vanish_x >= (img_center - thr_vp) && vanish_x <= (img_center + thr_vp)) {
    output = "Straight";
  }

  return output;
}

// PLOT RESULTS
/**
 *@brief This function plots both sides of the lane, the turn prediction message and a transparent polygon that covers the area inside the lane boundaries
 *@param inputImage is the original captured frame
 *@param lane is the vector containing the information of both lines
 *@param turn is the output string containing the turn information
 *@return The function returns a 0
 */
function plotLane(inputImage, lane, turn) {
  
  // let output = inputImage;
  let output = cv.Mat.zeros(inputImage.size(), inputImage.type());
   // Create the transparent polygon for a better visualization of the lane
  let npts = 4;
  let square_point_data = new Uint32Array([
      lane[2].x, lane[2].y,
      lane[0].x, lane[0].y,
      lane[1].x, lane[1].y,
      lane[3].x, lane[3].y]);

  let square_points = cv.matFromArray(npts, 1, cv.CV_32SC2, square_point_data);
  let pts = new cv.MatVector();
  //pts.push_back (square_points);
  let color = new cv.Scalar (0, 255, 0);
  // Create a binary polygon mask
  cv.fillConvexPoly(output, square_points, color, cv.LINE_AA, 0);
  cv.addWeighted(output, 0.3, inputImage, 0.7, 0, inputImage);

  // Plot both lines of the lane boundary
  cv.line(inputImage, lane[0], lane[1], new cv.Scalar(0, 255, 255), 5, cv.LINE_AA, 0);
  cv.line(inputImage, lane[2], lane[3], new cv.Scalar(0, 255, 255), 5, cv.LINE_AA, 0);

  // Plot the turn message
  cv.putText(inputImage, turn+"-" + fileName, new cv.Point(50, 90), cv.FONT_HERSHEY_COMPLEX_SMALL, 1, new cv.Scalar(0, 255, 0), 1, cv.LINE_AA);

  // Show the final output image
  // cv.namedWindow("Lane", cv.CV_WINDOW_AUTOSIZE);
  output.delete();
  // square_point_data.delete();
  pts.delete();
  cv.imshow("edge", inputImage);

}
