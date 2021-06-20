/***********************************************************
    Fields.
************************************************************/

var _camera_pos_tween,
    _camera_rot_tween;

/***********************************************************
    Functions.
************************************************************/

var _moveThenLookAt = function (camera, dstpos, dstlookat, options) {
    options || (options = { duration: 300 });

    var origpos = new THREE.Vector3().copy(camera.position); // original position
    var origrot = new THREE.Euler().copy(camera.rotation); // original rotation

    camera.position.set(dstpos.x, dstpos.y, dstpos.z);
    camera.lookAt(dstlookat);
    var dstrot = new THREE.Euler().copy(camera.rotation)

    // reset original position and rotation
    camera.position.set(origpos.x, origpos.y, origpos.z);
    camera.rotation.set(origrot.x, origrot.y, origrot.z);

    var tween_state = {
        rotate: false,
        translate: false,
        complete: false
    };
    
    // position
    _camera_pos_tween = new TWEEN.Tween(camera.position).to({
        x: dstpos.x,
        y: dstpos.y,
        z: dstpos.z
    }, options.duration).onStart(function () { tween_state.translate = true; }).onUpdate(function (c) {
            camera.position.x = this.x;
            camera.position.y = this.y;
            camera.position.z = this.z;
        }).onComplete(function () { tween_state.translate = false; tween_state.complete = true; }).start();

    // rotation (using slerp)
    (function () {
        var qa = qa = new THREE.Quaternion().copy(camera.quaternion); // src quaternion
        var qb = new THREE.Quaternion().setFromEuler(dstrot); // dst quaternion
        var qm = new THREE.Quaternion();
        camera.quaternion = qm;
    
        var o = { t: 0 };
        _camera_rot_tween = new TWEEN.Tween(o).to({ t: 1 }, options.duration).onStart(function () { tween_state.rotate = true; }).onComplete(function () {
            tween_state.rotate = false;
            tween_state.complete = true;
        }).onUpdate(function () {
            THREE.Quaternion.slerp(qa, qb, qm, o.t);
            camera.quaternion.set(qm.x, qm.y, qm.z, qm.w);
        }).start();
    }).call(this);

    return tween_state;
}