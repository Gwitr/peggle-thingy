const DISPENSER_RADIUS = 120;

var canvas = null;
var ctx = null;

function findAngle(mouseX, mouseY, ballX, ballY, ballSpeed, dispenserRadius) {
    let minSqrDist = 1000000.0;
    let minAngle = -Math.PI/4;
    let lineno = 0;
    for (let angle = 0; angle <= Math.PI; angle += Math.PI/2 * 1/50) {
        let angleMinSqrDist = 1000000.0;
        for (let t = 0; t < 50; t += 0.5) {
            let sqrDist = (mouseX - ballX - Math.cos(angle) * dispenserRadius - ballSpeed * t * Math.cos(angle)) ** 2 + (mouseY - ballY - Math.sin(angle) * dispenserRadius - ballSpeed * t * Math.sin(angle) - 1/2 * 0.5 * t**2) ** 2;
            // if (Math.abs(angle - 0) < 0.01)
                // ctx.fillText("IN 0.0 TEST " + sqrDist + " for " + t + " ball " + (ballSpeed * t * Math.cos(angle)) + ", " + (ballSpeed * t * Math.sin(angle) + 1/2 * t**2) + " mouse " + mouseX + ", " + mouseY, 0, 16 * ++lineno);
            if (sqrDist < angleMinSqrDist)
                angleMinSqrDist = sqrDist;
        }
        // ctx.fillText("test " + angle / Math.PI + " " + angleMinSqrDist, 0, 16 * ++lineno);
        if (angleMinSqrDist < minSqrDist) {
            minSqrDist = angleMinSqrDist;
            minAngle = angle;
        }
    }
    return minAngle;
}

class Circle {
    constructor(world, x, y, r, isStatic) {
        this.x = x;
        this.y = y;
        this.r = r;

        this.vx = 0;
        this.vy = 0;

        this.isStatic = !!isStatic;

        world.push(this);
        this.world = world;
    }

    update(deltaTime) {
        if (this.isStatic)
            return;

        this.x += this.vx * deltaTime;
        this.y += this.vy * deltaTime;

        for (let obj of this.world) {
            if (Object.is(obj, this))
                continue;

            let [unstickVector, normal] = obj.collide(this);
            if (unstickVector === null)
                continue;

            // Static resolution
            this.x += unstickVector.x;
            this.y += unstickVector.y;

            // Dynamic resolution
            let dot = normal.x * this.vx + normal.y * this.vy;
            this.vx -= 2 * dot * normal.x;
            this.vy -= 2 * dot * normal.y;

            // damp along direction
            dot = normal.x * this.vx + normal.y * this.vy;
            this.vx -= 0.3 * dot * normal.x;
            this.vy -= 0.3 * dot * normal.y;
        }

        if (this.x < -this.r || this.x > 800 + this.r || this.y < -this.r || this.y > 600 + this.r)
            this.destroy();
    }

    collide(other) {
        if (other instanceof Circle) {
            let dist = Math.sqrt((other.x - this.x)**2 + (other.y - this.y)**2);
            if (dist > this.r + other.r)
                return [null, null];
            return [
                {
                    x: -(other.x - this.x) / dist * (dist - this.r - other.r),
                    y: -(other.y - this.y) / dist * (dist - this.r - other.r)
                },
                {
                    x: -(other.x - this.x) / dist,
                    y: -(other.y - this.y) / dist
                }
            ];

        } else {
            throw new Error("Circle: idk how to collide with a " + other);
        }
    }

    draw() {
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.r, 0, 2 * Math.PI);
        ctx.stroke();
    
        ctx.beginPath();
        ctx.moveTo(this.x, this.y);
        ctx.arc(this.x, this.y, this.r, -Math.PI / 10, Math.PI / 10);
        ctx.lineTo(this.x, this.y);
        ctx.fillStyle = "black";
        ctx.fill();
    }

    destroy() {
        this.world.splice(this.world.findIndex(v => Object.is(this, v)), 1);
    }
};

class Peg extends Circle {
    constructor(world, x, y, r) {
        super(world, x, y, r, true);
        this.timeToDie = null;
    }

    collide(other) {
        let res = super.collide(other);
        if (this.timeToDie === null && res[0] != null)
            this.timeToDie = 1.5;
        return res;
    }

    update(deltaTime) {
        super.update(deltaTime);

        if (this.timeToDie !== null) {
            this.timeToDie -= deltaTime;
            if (this.timeToDie <= 0)
                this.destroy();
        }
    }

    draw() {
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.r, 0, 2 * Math.PI);
        ctx.stroke();
    
        ctx.beginPath();
        ctx.moveTo(this.x, this.y);
        ctx.arc(this.x, this.y, this.r, -Math.PI / 10, Math.PI / 10);
        ctx.lineTo(this.x, this.y);
        ctx.fillStyle = this.timeToDie === null ? "black" : "red";
        ctx.fill();
    }
}

onload = () => {
    canvas = document.getElementById("game-canvas");
    ctx = canvas.getContext("2d");

    let world = [];

    for (let i = -5; i <= 5; ++i) {
        for (let y = -2; y <= 2; ++y) {
            let circle = new Peg(world, 400 + 70 * i + (Math.random() * 2 - 1) * 20, 420 + 70 * y + (Math.random() * 2 - 1) * 20, 12);
            circle.vx = (Math.random() * 2 - 1) * 20;
        }
    }

    // let circle3 = new Circle(world, 100, 200, 50);
    // circle3.vx = 100;

    let mouseX = 0, mouseY = 0;
    let dispenserAngle = 0;
    canvas.addEventListener("mousemove", e => {
        e.preventDefault();
        mouseX = e.offsetX;
        mouseY = e.offsetY;
    });

    canvas.addEventListener("click", e => {
        if (e.button !== 0)
            return;
        e.preventDefault();

        let circle = new Circle(world, 400 + DISPENSER_RADIUS * Math.cos(dispenserAngle), 0 + DISPENSER_RADIUS * Math.sin(dispenserAngle), 9);
        // circle.vx = 33 /* TODO: ??? where does this come from?? */ * (mouseX - 400) / Math.sqrt(2 * (mouseY - 0) / 1);
        // Where does that 33 come from??
        circle.vx = 7.2 * 33 * Math.cos(dispenserAngle);
        circle.vy = 7.2 * 33 * Math.sin(dispenserAngle);
    });

    let deltaTime = 1000/60;
    var lastAnimFrame = null;
    var func = timestamp => {
        if (lastAnimFrame === null) {
            lastAnimFrame = timestamp;
            deltaTime = 1000/60;
        } else {
            deltaTime = timestamp - lastAnimFrame;
            lastAnimFrame = timestamp;
        }
        if (deltaTime > 1000/5) // Probably not lag but user switching tabs and coming back, assume nothing happened
            deltaTime = 1000/60;

        // Update
        // circle.vy += 1 * deltaTime;
        for (let obj of world) {
            if (!obj.static)
                obj.vy += 0.5 * deltaTime;  // TODO: should dt be applied here ???
            obj.update(deltaTime / 1000);
        }

        // Render
        ctx.fillStyle = "white";
        ctx.rect(0, 0, canvas.width, canvas.height);
        ctx.fill();

        // ctx.fillStyle = "black";
        ctx.font = "16px serif";
        // ctx.fillText(circle2.x + " " + circle2.y, 0, 16);

        for (let obj of world)
            obj.draw();

        dispenserAngle = findAngle(mouseX, mouseY, 400, 0, 7.2, DISPENSER_RADIUS);
        ctx.save();
            ctx.translate(400, 0);
            // ctx.rotate(dispenserAngle - Math.PI / 2);
            ctx.rotate(dispenserAngle - Math.PI / 2);
            ctx.translate(0, DISPENSER_RADIUS);
            ctx.beginPath();
                ctx.moveTo(-20, 0);
                ctx.lineTo(20, 0);
                ctx.lineTo(0, 50);
                ctx.lineTo(-20, 0);
            ctx.stroke();
        ctx.restore();

        ctx.beginPath();
            ctx.moveTo(mouseX - 10, mouseY);
            ctx.lineTo(mouseX + 10, mouseY);
            ctx.moveTo(mouseX, mouseY - 10);
            ctx.lineTo(mouseX, mouseY + 10);
        ctx.stroke();

        requestAnimationFrame(func);
    }
    requestAnimationFrame(func);
};
